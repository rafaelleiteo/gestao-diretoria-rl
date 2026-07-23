import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

async function runSendReminders() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const diagnostics: {
    ok: boolean;
    checked: number;
    sent: number;
    failures: Array<{ id: string; reason: string }>;
    logs: string[];
    error?: string;
  } = { ok: false, checked: 0, sent: 0, failures: [], logs: [] };

  const log = (m: string) => {
    console.log("[send-reminders]", m);
    diagnostics.logs.push(m);
  };

  if (!botToken || !chatId) {
    diagnostics.error = "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID";
    log(diagnostics.error);
    return diagnostics;
  }

  // Verify bot token before iterating.
  try {
    const me = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const meJson = (await me.json()) as { ok?: boolean; description?: string; result?: { username?: string } };
    if (!meJson.ok) {
      diagnostics.error = `Token inválido (getMe): ${meJson.description ?? me.status}`;
      log(diagnostics.error);
      return diagnostics;
    }
    log(`Bot autenticado: @${meJson.result?.username}`);
  } catch (e) {
    diagnostics.error = `Falha ao validar token: ${(e as Error).message}`;
    log(diagnostics.error);
    return diagnostics;
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const nowIso = new Date().toISOString();

  const { data: items, error } = await supabase
    .from("inbox_items")
    .select("id, texto, tipo, area, lembrete_data_hora")
    .eq("lembrete_enviado", false)
    .not("lembrete_data_hora", "is", null)
    .lte("lembrete_data_hora", nowIso);

  if (error) {
    diagnostics.error = `DB: ${error.message}`;
    log(diagnostics.error);
    return diagnostics;
  }

  diagnostics.checked = items?.length ?? 0;
  log(`${diagnostics.checked} lembrete(s) pendente(s) encontrado(s)`);

  const areaLabels: Record<string, string> = {
    diretoria: "Diretoria",
    financeiro: "Financeiro",
    consultorio: "Consultório",
    versa3d: "Versa3D",
    especializacao: "Especialização",
    graduacao: "Graduação",
    doutorado: "Doutorado",
    dentistas_petropolis: "Dentistas Petrópolis",
    connect_lab: "Connect Lab",
    gestao: "Gestão",
  };
  const tipoLabels: Record<string, string> = {
    mensagem: "Mensagem",
    ideia: "Ideia",
    tarefa: "Tarefa",
  };

  for (const item of items ?? []) {
    const areaName = areaLabels[item.area as string] ?? item.area;
    const tipoName = tipoLabels[item.tipo as string] ?? item.tipo;
    const text = `⏰ Lembrete [${areaName}] — ${tipoName}: ${item.texto}`;

    try {
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
      const body = await resp.text();
      if (!resp.ok) {
        const reason = `HTTP ${resp.status}: ${body}`;
        diagnostics.failures.push({ id: item.id, reason });
        log(`Falha item ${item.id}: ${reason}`);
        continue;
      }
      const json = JSON.parse(body) as { ok?: boolean; description?: string };
      if (!json.ok) {
        diagnostics.failures.push({ id: item.id, reason: json.description ?? "telegram not ok" });
        continue;
      }
      const { error: updErr } = await supabase
        .from("inbox_items")
        .update({ lembrete_enviado: true })
        .eq("id", item.id);
      if (updErr) {
        diagnostics.failures.push({ id: item.id, reason: `update: ${updErr.message}` });
        continue;
      }
      diagnostics.sent += 1;
      log(`Enviado: ${item.id}`);
    } catch (e) {
      diagnostics.failures.push({ id: item.id, reason: (e as Error).message });
    }
  }

  diagnostics.ok = true;
  return diagnostics;
}

export const Route = createFileRoute("/api/public/hooks/send-reminders")({
  server: {
    handlers: {
      POST: async () => {
        const result = await runSendReminders();
        return new Response(JSON.stringify(result), {
          status: result.ok ? 200 : 500,
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () => {
        const result = await runSendReminders();
        return new Response(JSON.stringify(result), {
          status: result.ok ? 200 : 500,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
