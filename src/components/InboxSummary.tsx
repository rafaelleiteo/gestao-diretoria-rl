import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { TAB_AREAS, areaLabel, type AreaValue } from "@/lib/areas";
import { isItemPending, type InboxItem, type Prioridade } from "@/components/Inbox";

function useAllItems() {
  return useQuery({
    queryKey: ["inbox_items", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inbox_items")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data as unknown as InboxItem[]).map((i) => ({
        ...i,
        prioridades: (i.prioridades ?? []) as Prioridade[],
      }));
    },
  });
}

type Counter = { label: string; value: number; accent?: boolean };

function Counters({ items }: { items: Counter[] }) {
  return (
    <div
      className="flex flex-wrap items-stretch gap-2 rounded-2xl border bg-white px-5 py-4"
      style={{ borderColor: "#EDEDED" }}
    >
      {items.map((c, idx) => (
        <div
          key={c.label}
          className="flex flex-1 min-w-[110px] flex-col items-start justify-center px-2"
          style={
            idx > 0
              ? { borderLeft: "1px solid #EDEDED" }
              : undefined
          }
        >
          <span
            className="text-[26px] font-semibold leading-none"
            style={{
              color: c.accent ? "#4F46E5" : "#111111",
              letterSpacing: "-0.02em",
            }}
          >
            {c.value}
          </span>
          <span
            className="mt-1.5 text-[11px] font-medium uppercase tracking-wider"
            style={{ color: "#6B7280" }}
          >
            {c.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function countByPriority(items: InboxItem[], p: Prioridade): number {
  return items.filter((i) => isItemPending(i) && i.prioridades?.includes(p)).length;
}

export function HomeSummary() {
  const { data } = useAllItems();
  const counters = useMemo<Counter[]>(() => {
    const items = data ?? [];
    return [
      { label: "Urgentes", value: countByPriority(items, "urgente"), accent: true },
      { label: "Pra hoje", value: countByPriority(items, "hoje") },
      { label: "Importantes", value: countByPriority(items, "importante") },
    ];
  }, [data]);

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2
          className="text-[13px] font-semibold uppercase tracking-wider"
          style={{ color: "#6B7280" }}
        >
          Resumo
        </h2>
        <Link
          to="/dashboard"
          className="text-[12px] font-medium"
          style={{ color: "#4F46E5" }}
        >
          Visão completa →
        </Link>
      </div>
      <Counters items={counters} />
    </div>
  );
}

export function AreaSummary({ area }: { area: AreaValue }) {
  const { data } = useAllItems();
  const counters = useMemo<Counter[]>(() => {
    const items = (data ?? []).filter((i) => i.area === area);
    const pending = items.filter((i) => isItemPending(i));
    return [
      { label: "Urgentes", value: countByPriority(items, "urgente"), accent: true },
      { label: "Importantes", value: countByPriority(items, "importante") },
      { label: "Pendentes", value: pending.length },
    ];
  }, [data, area]);

  return (
    <div className="mt-6">
      <div className="mb-3">
        <h2
          className="text-[13px] font-semibold uppercase tracking-wider"
          style={{ color: "#6B7280" }}
        >
          Resumo desta área
        </h2>
      </div>
      <Counters items={counters} />
    </div>
  );
}

const PRIORIDADES: { value: Prioridade; label: string }[] = [
  { value: "urgente", label: "Urgente" },
  { value: "importante", label: "Importante" },
  { value: "hoje", label: "Hoje" },
  { value: "longo_prazo", label: "Longo prazo" },
  { value: "indiferente", label: "Indiferente" },
  { value: "descarga", label: "Descarga" },
];

function BarRow({
  label,
  value,
  max,
  accent,
}: {
  label: string;
  value: number;
  max: number;
  accent?: boolean;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span
        className="w-40 shrink-0 text-[13px]"
        style={{ color: "#111111" }}
      >
        {label}
      </span>
      <div
        className="relative h-2 flex-1 overflow-hidden rounded-full"
        style={{ backgroundColor: "#FAFAFA" }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${pct}%`,
            backgroundColor: accent ? "#4F46E5" : "#B0B4BC",
          }}
        />
      </div>
      <span
        className="w-8 text-right text-[13px] font-semibold tabular-nums"
        style={{ color: "#111111" }}
      >
        {value}
      </span>
    </div>
  );
}

function startOfWeek(d: Date): Date {
  // ISO week start Monday
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = dt.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // days since Monday
  dt.setDate(dt.getDate() - diff);
  return dt;
}

function formatWeekLabel(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function DashboardView() {
  const { data, isLoading } = useAllItems();

  const byArea = useMemo(() => {
    const items = (data ?? []).filter((i) => isItemPending(i));
    return TAB_AREAS.map((a) => ({
      label: a.label,
      value: items.filter((i) => i.area === a.slug).length,
    })).sort((a, b) => b.value - a.value);
  }, [data]);

  const byPriority = useMemo(() => {
    const items = (data ?? []).filter((i) => isItemPending(i));
    return PRIORIDADES.map((p) => ({
      label: p.label,
      value: items.filter((i) => i.prioridades?.includes(p.value)).length,
      accent: p.value === "urgente",
    }));
  }, [data]);

  const history = useMemo(() => {
    // Last 12 ISO weeks of concluido_em
    const buckets: { start: Date; label: string; count: number }[] = [];
    const now = new Date();
    const thisWeek = startOfWeek(now);
    for (let i = 11; i >= 0; i--) {
      const s = new Date(thisWeek);
      s.setDate(s.getDate() - i * 7);
      buckets.push({ start: s, label: formatWeekLabel(s), count: 0 });
    }
    const items = data ?? [];
    for (const i of items) {
      if (!i.concluido_em) continue;
      const wk = startOfWeek(new Date(i.concluido_em));
      const b = buckets.find((x) => x.start.getTime() === wk.getTime());
      if (b) b.count += 1;
    }
    return buckets;
  }, [data]);

  const maxArea = Math.max(1, ...byArea.map((b) => b.value));
  const maxPriority = Math.max(1, ...byPriority.map((b) => b.value));
  const maxHist = Math.max(1, ...history.map((b) => b.count));

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8">
        <Link
          to="/"
          className="text-[12px] font-medium"
          style={{ color: "#6B7280" }}
        >
          ← Voltar
        </Link>
        <h1
          className="mt-2 text-3xl font-bold"
          style={{ color: "#111111", letterSpacing: "-0.02em" }}
        >
          Visão completa
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: "#6B7280" }}>
          Distribuição das tarefas pendentes e histórico de conclusões.
        </p>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-[13px]" style={{ color: "#B0B4BC" }}>
          Carregando...
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <section
            className="rounded-2xl border bg-white p-5"
            style={{ borderColor: "#EDEDED" }}
          >
            <h2
              className="mb-4 text-[13px] font-semibold uppercase tracking-wider"
              style={{ color: "#6B7280" }}
            >
              Pendentes por área
            </h2>
            <div>
              {byArea.map((b) => (
                <BarRow key={b.label} label={b.label} value={b.value} max={maxArea} />
              ))}
            </div>
          </section>

          <section
            className="rounded-2xl border bg-white p-5"
            style={{ borderColor: "#EDEDED" }}
          >
            <h2
              className="mb-4 text-[13px] font-semibold uppercase tracking-wider"
              style={{ color: "#6B7280" }}
            >
              Pendentes por prioridade
            </h2>
            <div>
              {byPriority.map((b) => (
                <BarRow
                  key={b.label}
                  label={b.label}
                  value={b.value}
                  max={maxPriority}
                  accent={b.accent}
                />
              ))}
            </div>
          </section>

          <section
            className="rounded-2xl border bg-white p-5 md:col-span-2"
            style={{ borderColor: "#EDEDED" }}
          >
            <h2
              className="mb-4 text-[13px] font-semibold uppercase tracking-wider"
              style={{ color: "#6B7280" }}
            >
              Concluídos — últimas 12 semanas
            </h2>
            <div className="flex h-40 items-end gap-2">
              {history.map((b) => {
                const h = (b.count / maxHist) * 100;
                return (
                  <div
                    key={b.label}
                    className="flex flex-1 flex-col items-center gap-1"
                  >
                    <span
                      className="text-[10px] tabular-nums"
                      style={{ color: "#6B7280" }}
                    >
                      {b.count || ""}
                    </span>
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${Math.max(h, b.count > 0 ? 4 : 0)}%`,
                        backgroundColor: b.count > 0 ? "#4F46E5" : "#F5F5F5",
                        minHeight: 2,
                      }}
                    />
                    <span
                      className="text-[10px]"
                      style={{ color: "#B0B4BC" }}
                    >
                      {b.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export { areaLabel };
