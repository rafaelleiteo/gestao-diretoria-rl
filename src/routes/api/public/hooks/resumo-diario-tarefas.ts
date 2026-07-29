import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const TZ = "America/Sao_Paulo";
const JS_DAY_TO_DIA = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;
type DiaSemana = (typeof JS_DAY_TO_DIA)[number];

const AREA_LABELS: Record<string, string> = {
  geral: "Geral",
  diretoria: "Diretoria",
  financeiro: "Financeiro",
  consultorio: "Consultório",
  versa3d: "Versa3D",
  especializacao: "Especialização",
  graduacao: "Graduação",
  doutorado: "Doutorado",
  "dentistas-petropolis": "Dentistas Petrópolis",
  "connect-lab": "Connect Lab",
  gestao: "Gestão",
};

/** Date parts (y/m/d + weekday) of "now" in São Paulo. */
function nowInTz() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const y = Number(get("year"));
  const m = Number(get("month"));
  const d = Number(get("day"));
  const wkMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayIdx = wkMap[get("weekday")] ?? 0;
  // Local-noon anchor keeps date math free of DST edge cases.
  const today = new Date(Date.UTC(y, m - 1, d, 12));
  return { y, m, d, dayIdx, dia: JS_DAY_TO_DIA[dayIdx], today };
}

function clampDay(y: number, monthIdx: number, day: number) {
  return Math.min(day, new Date(Date.UTC(y, monthIdx + 1, 0)).getUTCDate());
}

function mkDate(y: number, monthIdx: number, day: number) {
  return new Date(Date.UTC(y, monthIdx, day, 12));
}

/** UTC instant of São Paulo midnight for the given y/m/d (BRT = UTC-3). */
function tzMidnightUtc(y: number, monthIdx: number, day: number) {
  return new Date(Date.UTC(y, monthIdx, day, 3));
}

type InboxRow = {
  id: string;
  texto: string;
  area: string;
  tipo: string;
  concluido: boolean;
  concluido_em: string | null;
  dia_semana: DiaSemana | null;
  prioridades: string[] | null;
  aguardando_feedback: boolean;
  lembrete_data_hora: string | null;
};

type TarefaRow = {
  id: string;
  titulo: string;
  area: string;
  tipo_recorrencia: string;
  dia_mes: number | null;
  dia_semana: DiaSemana | null;
  data_inicio: string | null;
  intervalo_meses: number | null;
  ultima_conclusao: string | null;
};

function mostRecentWeekdayOccurrence(dia: DiaSemana, ctx: ReturnType<typeof nowInTz>) {
  const target = JS_DAY_TO_DIA.indexOf(dia);
  let diff = ctx.dayIdx - target;
  if (diff < 0) diff += 7;
  const d = new Date(ctx.today);
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

function isInboxPending(item: InboxRow, ctx: ReturnType<typeof nowInTz>) {
  if (item.dia_semana) {
    if (!item.concluido || !item.concluido_em) return true;
    return new Date(item.concluido_em) < mostRecentWeekdayOccurrence(item.dia_semana, ctx);
  }
  return !item.concluido;
}

function mostRecentOccurrenceForTarefa(t: TarefaRow, ctx: ReturnType<typeof nowInTz>): Date | null {
  const today = ctx.today;
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();

  if (t.tipo_recorrencia === "dia_mes" && t.dia_mes) {
    const thisMonthDay = clampDay(y, m, t.dia_mes);
    if (today.getUTCDate() >= thisMonthDay) return mkDate(y, m, thisMonthDay);
    const prevY = m === 0 ? y - 1 : y;
    const prevM = m === 0 ? 11 : m - 1;
    return mkDate(prevY, prevM, clampDay(prevY, prevM, t.dia_mes));
  }

  if (t.tipo_recorrencia === "dia_semana" && t.dia_semana) {
    return mostRecentWeekdayOccurrence(t.dia_semana, ctx);
  }

  if (t.tipo_recorrencia === "intervalo_meses" && t.data_inicio && t.intervalo_meses) {
    const [sy, sm, sd] = t.data_inicio.split("-").map(Number);
    const start = mkDate(sy, (sm ?? 1) - 1, sd ?? 1);
    if (start > today) return null;
    const startY = start.getUTCFullYear();
    const startM = start.getUTCMonth();
    const startDay = start.getUTCDate();
    const monthsSince = (y - startY) * 12 + (m - startM);
    const k = Math.floor(monthsSince / t.intervalo_meses);
    const build = (kk: number) => {
      const totalM = startM + kk * t.intervalo_meses!;
      const yy = startY + Math.floor(totalM / 12);
      const mm = ((totalM % 12) + 12) % 12;
      return mkDate(yy, mm, clampDay(yy, mm, startDay));
    };
    let cand = build(k);
    if (cand > today && k > 0) cand = build(k - 1);
    return cand;
  }

  return null;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function escapeMd(s: string) {
  return s.replace(/([*_`\[\]])/g, "\\$1");
}

async function runResumoDiario() {
  const diagnostics: {
    ok: boolean;
    data: string;
    counts: { prioridade_hoje: number; dia_semana: number; tarefas_recorrentes: number; lembretes: number; aguardando_feedback: number; planejado_total: number };
    sent: boolean;
    message?: string;
    logs: string[];
    error?: string;
  } = {
    ok: false,
    data: "",
    counts: { prioridade_hoje: 0, dia_semana: 0, tarefas_recorrentes: 0, lembretes: 0, aguardando_feedback: 0, planejado_total: 0 },
    sent: false,
    logs: [],
  };

  const log = (m: string) => {
    console.log("[resumo-diario-tarefas]", m);
    diagnostics.logs.push(m);
  };

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    diagnostics.error = "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID";
    log(diagnostics.error);
    return diagnostics;
  }

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

  const ctx = nowInTz();
  const dataLabel = `${String(ctx.d).padStart(2, "0")}/${String(ctx.m).padStart(2, "0")}`;
  diagnostics.data = dataLabel;
  log(`Data de referência (${TZ}): ${dataLabel} (${ctx.dia})`);

  const [{ data: inbox, error: inboxErr }, { data: tarefas, error: tarefasErr }] = await Promise.all([
    supabase
      .from("inbox_items")
      .select("id, texto, area, tipo, concluido, concluido_em, dia_semana, prioridades, aguardando_feedback, lembrete_data_hora")
      .order("criado_em", { ascending: false }),
    supabase.from("tarefas_recorrentes").select("*"),
  ]);

  if (inboxErr || tarefasErr) {
    diagnostics.error = `DB: ${inboxErr?.message ?? tarefasErr?.message}`;
    log(diagnostics.error);
    return diagnostics;
  }

  const items = (inbox ?? []) as InboxRow[];
  const tarefasList = (tarefas ?? []) as TarefaRow[];

  const grupo1 = items.filter(
    (i) => !i.aguardando_feedback && !i.concluido && (i.prioridades ?? []).includes("hoje"),
  );
  const grupo2 = items.filter(
    (i) => !i.aguardando_feedback && i.dia_semana === ctx.dia && isInboxPending(i, ctx),
  );

  const dayStart = tzMidnightUtc(ctx.y, ctx.m - 1, ctx.d);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const grupo4 = items.filter((i) => {
    if (i.concluido || !i.lembrete_data_hora) return false;
    const t = new Date(i.lembrete_data_hora);
    return t >= dayStart && t < dayEnd;
  });

  const grupo3 = tarefasList.filter((t) => {
    const occ = mostRecentOccurrenceForTarefa(t, ctx);
    if (!occ || !sameDay(occ, ctx.today)) return false;
    if (!t.ultima_conclusao) return true;
    return new Date(t.ultima_conclusao) < tzMidnightUtc(occ.getUTCFullYear(), occ.getUTCMonth(), occ.getUTCDate());
  });

  const feedback = items.filter((i) => i.aguardando_feedback && !i.concluido);

  diagnostics.counts = {
    prioridade_hoje: grupo1.length,
    dia_semana: grupo2.length,
    tarefas_recorrentes: grupo3.length,
    lembretes: grupo4.length,
    aguardando_feedback: feedback.length,
    planejado_total: 0,
  };
  log(
    `Encontrados — prioridade hoje: ${grupo1.length}, dia da semana: ${grupo2.length}, tarefas recorrentes: ${grupo3.length}, lembretes hoje: ${grupo4.length}, aguardando feedback: ${feedback.length}`,
  );

  const seen = new Set<string>();
  const bullets: string[] = [];
  const pushInbox = (list: InboxRow[]) => {
    for (const i of list) {
      if (seen.has(i.id)) continue;
      seen.add(i.id);
      const area = AREA_LABELS[i.area] ?? i.area;
      bullets.push(`• ${escapeMd(i.texto)}${area ? ` (${escapeMd(area)})` : ""}`);
    }
  };
  pushInbox(grupo1);
  pushInbox(grupo2);
  for (const t of grupo3) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    const area = AREA_LABELS[t.area] ?? t.area;
    bullets.push(`• ${escapeMd(t.titulo)}${area ? ` (${escapeMd(area)})` : ""}`);
  }
  pushInbox(grupo4);
  diagnostics.counts.planejado_total = bullets.length;

  const lines: string[] = [`📋 *Resumo do dia — ${dataLabel}*`, ""];
  if (bullets.length > 0) {
    lines.push("*Planejado para hoje*", ...bullets);
  } else {
    lines.push("Nenhuma tarefa planejada hoje 🎉");
  }
  if (feedback.length > 0) {
    lines.push("", "*Aguardando feedback*");
    for (const i of feedback) {
      const area = AREA_LABELS[i.area] ?? i.area;
      lines.push(`• ${escapeMd(i.texto)}${area ? ` (${escapeMd(area)})` : ""}`);
    }
  }
  const message = lines.join("\n");
  diagnostics.message = message;

  try {
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "Markdown" }),
    });
    const body = await resp.text();
    if (!resp.ok) {
      diagnostics.error = `Telegram HTTP ${resp.status}: ${body}`;
      log(diagnostics.error);
      return diagnostics;
    }
    const json = JSON.parse(body) as { ok?: boolean; description?: string };
    if (!json.ok) {
      diagnostics.error = `Telegram: ${json.description ?? "not ok"}`;
      log(diagnostics.error);
      return diagnostics;
    }
    diagnostics.sent = true;
    log("Resumo enviado com sucesso");
  } catch (e) {
    diagnostics.error = `Falha no envio: ${(e as Error).message}`;
    log(diagnostics.error);
    return diagnostics;
  }

  diagnostics.ok = true;
  return diagnostics;
}

export const Route = createFileRoute("/api/public/hooks/resumo-diario-tarefas")({
  server: {
    handlers: {
      POST: async () => {
        const result = await runResumoDiario();
        return new Response(JSON.stringify(result), {
          status: result.ok ? 200 : 500,
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () => {
        const result = await runResumoDiario();
        return new Response(JSON.stringify(result), {
          status: result.ok ? 200 : 500,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
