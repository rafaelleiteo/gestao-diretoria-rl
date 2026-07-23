import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

async function runSendReminders() {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;

        if (!botToken || !chatId) {
          return new Response(
            JSON.stringify({ error: "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
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
          console.error("Failed to load pending reminders:", error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

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

        let sent = 0;
        const failures: Array<{ id: string; reason: string }> = [];

        for (const item of items ?? []) {
          const areaName = areaLabels[item.area as string] ?? item.area;
          const tipoName = tipoLabels[item.tipo as string] ?? item.tipo;
          const text = `⏰ Lembrete [${areaName}] — ${tipoName}: ${item.texto}`;

          try {
            const resp = await fetch(
              `https://api.telegram.org/bot${botToken}/sendMessage`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatId, text }),
              },
            );
            if (!resp.ok) {
              const body = await resp.text();
              failures.push({ id: item.id, reason: `HTTP ${resp.status}: ${body}` });
              continue;
            }
            const json = (await resp.json()) as { ok?: boolean; description?: string };
            if (!json.ok) {
              failures.push({ id: item.id, reason: json.description ?? "telegram not ok" });
              continue;
            }

            const { error: updErr } = await supabase
              .from("inbox_items")
              .update({ lembrete_enviado: true })
              .eq("id", item.id);
            if (updErr) {
              failures.push({ id: item.id, reason: `update: ${updErr.message}` });
              continue;
            }
            sent += 1;
          } catch (e) {
            failures.push({ id: item.id, reason: (e as Error).message });
          }
        }

        return new Response(
          JSON.stringify({ ok: true, checked: items?.length ?? 0, sent, failures }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
