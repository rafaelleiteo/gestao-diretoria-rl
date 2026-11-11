import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useMemo } from "react";
import {
  LayoutDashboard,
  Calendar,
  PieChart,
  TrendingUp,
  CreditCard,
  Building2,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { getCurrentUser } from "@/lib/auth.functions";
import { getDashboardLancamentos } from "@/lib/lancamentos.functions";

export const Route = createFileRoute("/financeiro/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Financeiro — Rafael Leite" },
      { name: "description", content: "Dashboard de análise e tendência financeira." },
    ],
  }),
  component: FinanceiroDashboardPage,
});

function parseCompetencia(comp: string): { month: number; year: number } | null {
  if (!comp || !comp.includes("/")) return null;
  const parts = comp.split("/");
  const m = parseInt(parts[0], 10);
  const y = parseInt(parts[1], 10);
  if (isNaN(m) || isNaN(y)) return null;
  return { month: m, year: y };
}

function compareCompetencias(compA: string, compB: string): number {
  const pA = parseCompetencia(compA);
  const pB = parseCompetencia(compB);
  if (!pA || !pB) return 0;
  if (pA.year !== pB.year) return pA.year - pB.year;
  return pA.month - pB.month;
}

function isCompetenciaAfter(compA: string, compB: string): boolean {
  return compareCompetencias(compA, compB) > 0;
}

function getCurrentMonthCompetencia(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${m}/${d.getFullYear()}`;
}

function getPreviousMonths(selectedComp: string, count = 6): string[] {
  const p = parseCompetencia(selectedComp);
  if (!p) return [selectedComp];
  const list: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    let totalMonths = p.year * 12 + (p.month - 1) - i;
    let y = Math.floor(totalMonths / 12);
    let m = (totalMonths % 12) + 1;
    list.push(`${String(m).padStart(2, "0")}/${y}`);
  }
  return list;
}

function formatBRL(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function FinanceiroDashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const currentMonthStr = getCurrentMonthCompetencia();
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);

  const fetchUser = useServerFn(getCurrentUser);
  const fetchDashboard = useServerFn(getDashboardLancamentos);

  // Auth Guard & Data Loading
  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const u = await fetchUser();
        if (!active) return;
        setUser(u);

        if (!u || u.role !== "admin") {
          toast.error("Acesso restrito a administradores");
          navigate({ to: "/" });
          return;
        }

        const data = await fetchDashboard();
        if (!active) return;
        setLancamentos(data);
      } catch (err: any) {
        toast.error("Erro ao carregar dados do dashboard: " + err.message);
      } finally {
        if (active) {
          setIsLoadingAuth(false);
          setIsLoadingData(false);
        }
      }
    }
    init();
    return () => {
      active = false;
    };
  }, []);

  // Compute available month choices for dropdown
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    set.add(currentMonthStr);
    for (const item of lancamentos) {
      if (item.competencia) {
        set.add(item.competencia.trim());
      }
    }
    const list = Array.from(set);
    list.sort((a, b) => compareCompetencias(b, a)); // newest first
    return list;
  }, [lancamentos, currentMonthStr]);

  // Items for selected month
  const monthItems = useMemo(() => {
    return lancamentos.filter((item) => item.competencia === selectedMonth);
  }, [lancamentos, selectedMonth]);

  // Block 1: Month Total & Area Breakdown
  const monthTotalSpent = useMemo(() => {
    return monthItems.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
  }, [monthItems]);

  const areaBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of monthItems) {
      const area = (item.area || "Sem Área").trim();
      const val = Number(item.valor) || 0;
      map.set(area, (map.get(area) || 0) + val);
    }
    const result = Array.from(map.entries()).map(([area, total]) => ({
      area,
      total,
      percentage: monthTotalSpent > 0 ? (total / monthTotalSpent) * 100 : 0,
    }));
    result.sort((a, b) => b.total - a.total);
    return result;
  }, [monthItems, monthTotalSpent]);

  // Block 2: Category Breakdown
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of monthItems) {
      const cat = (item.categoria || "Sem Categoria").trim();
      const val = Number(item.valor) || 0;
      map.set(cat, (map.get(cat) || 0) + val);
    }
    const result = Array.from(map.entries()).map(([categoria, total]) => ({
      categoria,
      total,
      percentage: monthTotalSpent > 0 ? (total / monthTotalSpent) * 100 : 0,
    }));
    result.sort((a, b) => b.total - a.total);
    return result;
  }, [monthItems, monthTotalSpent]);

  // Block 3: 6-Month Trend
  const trendMonths = useMemo(() => {
    return getPreviousMonths(selectedMonth, 6);
  }, [selectedMonth]);

  const trendData = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of trendMonths) {
      map.set(m, 0);
    }
    for (const item of lancamentos) {
      if (item.competencia && map.has(item.competencia.trim())) {
        const current = map.get(item.competencia.trim()) || 0;
        map.set(item.competencia.trim(), current + (Number(item.valor) || 0));
      }
    }
    const list = trendMonths.map((m) => ({
      month: m,
      total: map.get(m) || 0,
    }));
    const maxTotal = Math.max(...list.map((d) => d.total), 1);
    return { list, maxTotal };
  }, [lancamentos, trendMonths]);

  // Block 4: Comprometido em Parcelas Futuras
  const futureCommitted = useMemo(() => {
    const futureItems = lancamentos.filter(
      (item) =>
        item.parcelas_totais > 1 &&
        item.competencia &&
        isCompetenciaAfter(item.competencia.trim(), selectedMonth)
    );

    const totalAll = futureItems.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);

    const monthMap = new Map<string, { total: number; count: number }>();
    for (const item of futureItems) {
      const comp = item.competencia.trim();
      const existing = monthMap.get(comp) || { total: 0, count: 0 };
      monthMap.set(comp, {
        total: existing.total + (Number(item.valor) || 0),
        count: existing.count + 1,
      });
    }

    const breakdown = Array.from(monthMap.entries()).map(([comp, data]) => ({
      competencia: comp,
      total: data.total,
      count: data.count,
    }));

    breakdown.sort((a, b) => compareCompetencias(a.competencia, b.competencia));

    return { totalAll, breakdown, hasFuture: breakdown.length > 0 };
  }, [lancamentos, selectedMonth]);

  if (isLoadingAuth || isLoadingData) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[13px] text-gray-500">Carregando dashboard financeiro...</p>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return null;
  }

  const AREA_COLORS = ["#4F46E5", "#6366F1", "#818CF8", "#A5B4FC", "#C7D2FE", "#E0E7FF"];

  return (
    <div className="space-y-6">
      {/* Top Header & Month Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "#111111", letterSpacing: "-0.02em" }}
          >
            Dashboard Financeiro
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "#6B7280" }}>
            Visão consolidada de lançamentos validados, áreas, categorias e tendências.
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <label className="text-[12px] font-medium text-gray-600 flex items-center gap-1.5">
            <Calendar size={14} className="text-indigo-600" />
            Mês de Referência:
          </label>
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none rounded-full border px-4 py-1.5 pr-8 text-[12px] font-semibold text-gray-800 bg-white outline-none focus:border-indigo-600 shadow-sm transition-colors cursor-pointer"
              style={{ borderColor: "#EDEDED" }}
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {m} {m === currentMonthStr ? "(Mês Atual)" : ""}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
          </div>
        </div>
      </div>

      {/* Grid 1: Resumo do Mês & Por Área */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Card Resumo Total */}
        <div
          className="rounded-2xl border bg-white p-5 space-y-4 shadow-sm flex flex-col justify-between"
          style={{ borderColor: "#EDEDED" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-gray-500 uppercase tracking-wider">
              <LayoutDashboard size={16} className="text-indigo-600" />
              Total Gasto — {selectedMonth}
            </div>
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700">
              Validados
            </span>
          </div>

          <div>
            <div className="text-3xl font-extrabold text-gray-900 tracking-tight">
              {formatBRL(monthTotalSpent)}
            </div>
            <p className="mt-1 text-[12px] text-gray-400">
              {monthItems.length} lançamento(s) conciliado(s) neste mês.
            </p>
          </div>

          {monthItems.length === 0 && (
            <div className="rounded-xl border border-dashed p-4 text-center text-[12px] text-gray-400" style={{ borderColor: "#EDEDED" }}>
              Nenhum lançamento validado neste mês.
            </div>
          )}
        </div>

        {/* Card Detalhamento por Área */}
        <div
          className="rounded-2xl border bg-white p-5 space-y-4 shadow-sm"
          style={{ borderColor: "#EDEDED" }}
        >
          <div className="flex items-center gap-2 text-[12px] font-semibold text-gray-500 uppercase tracking-wider">
            <Building2 size={16} className="text-indigo-600" />
            Gastos por Área ({selectedMonth})
          </div>

          {areaBreakdown.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-center text-[12px] text-gray-400" style={{ borderColor: "#EDEDED" }}>
              Nenhuma área registrada para este mês.
            </div>
          ) : (
            <div className="space-y-3">
              {areaBreakdown.map((item, idx) => (
                <div key={item.area} className="space-y-1">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-semibold text-gray-800">{item.area}</span>
                    <span className="font-mono font-medium text-gray-900">
                      {formatBRL(item.total)}{" "}
                      <span className="text-[11px] text-gray-400">
                        ({item.percentage.toFixed(1)}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full transition-all duration-500 rounded-full"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: AREA_COLORS[idx % AREA_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid 2: Detalhamento por Categoria */}
      <div
        className="rounded-2xl border bg-white p-5 space-y-4 shadow-sm"
        style={{ borderColor: "#EDEDED" }}
      >
        <div className="flex items-center gap-2 text-[12px] font-semibold text-gray-500 uppercase tracking-wider">
          <PieChart size={16} className="text-indigo-600" />
          Gastos por Categoria ({selectedMonth})
        </div>

        {categoryBreakdown.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-[12px] text-gray-400" style={{ borderColor: "#EDEDED" }}>
            Nenhum lançamento por categoria neste mês.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categoryBreakdown.map((c) => (
              <div
                key={c.categoria}
                className="rounded-xl border p-3.5 space-y-2 bg-gray-50/50"
                style={{ borderColor: "#EDEDED" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-gray-900 truncate">
                    {c.categoria}
                  </span>
                  <span className="rounded-full bg-gray-200/60 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                    {c.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="text-[14px] font-bold font-mono text-indigo-950">
                  {formatBRL(c.total)}
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                    style={{ width: `${c.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Block 3: Tendência dos Últimos 6 Meses */}
      <div
        className="rounded-2xl border bg-white p-5 space-y-4 shadow-sm"
        style={{ borderColor: "#EDEDED" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-gray-500 uppercase tracking-wider">
            <TrendingUp size={16} className="text-indigo-600" />
            Tendência de Gastos — Últimos 6 Meses
          </div>
          <span className="text-[11px] text-gray-400">Até {selectedMonth}</span>
        </div>

        {trendData.list.every((d) => d.total === 0) ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-[12px] text-gray-400" style={{ borderColor: "#EDEDED" }}>
            Sem dados de lançamentos validados nos últimos 6 meses.
          </div>
        ) : (
          <div className="pt-6 pb-2">
            <div className="flex h-44 items-end justify-between gap-2 sm:gap-4 px-2">
              {trendData.list.map((item) => {
                const heightPercent =
                  trendData.maxTotal > 0 ? (item.total / trendData.maxTotal) * 100 : 0;
                const isCurrentSelected = item.month === selectedMonth;

                return (
                  <div
                    key={item.month}
                    className="flex flex-1 flex-col items-center gap-2 h-full justify-end group"
                  >
                    {/* Amount Label */}
                    <span className="text-[10px] font-mono font-medium text-gray-600 truncate max-w-full">
                      {item.total > 0 ? formatBRL(item.total) : "R$ 0"}
                    </span>

                    {/* Bar */}
                    <div className="w-full max-w-[48px] rounded-t-lg bg-gray-100 h-32 flex items-end overflow-hidden p-0.5">
                      <div
                        className={`w-full rounded-t-md transition-all duration-500 ${
                          isCurrentSelected
                            ? "bg-indigo-600"
                            : "bg-indigo-300 group-hover:bg-indigo-400"
                        }`}
                        style={{ height: `${Math.max(heightPercent, 3)}%` }}
                      />
                    </div>

                    {/* Month Label */}
                    <span
                      className={`text-[11px] font-medium transition-colors ${
                        isCurrentSelected ? "text-indigo-600 font-bold" : "text-gray-500"
                      }`}
                    >
                      {item.month}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Block 4: Comprometido em Parcelas Futuras */}
      <div
        className="rounded-2xl border bg-white p-5 space-y-4 shadow-sm"
        style={{ borderColor: "#EDEDED" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-4" style={{ borderColor: "#EDEDED" }}>
          <div>
            <div className="flex items-center gap-2 text-[12px] font-semibold text-gray-500 uppercase tracking-wider">
              <CreditCard size={16} className="text-indigo-600" />
              Comprometido em Parcelas Futuras
            </div>
            <p className="mt-1 text-[12px] text-gray-500">
              Compras parceladas validadas com vencimento após {selectedMonth}.
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-gray-400 block uppercase font-semibold">
              Total Comprometido
            </span>
            <span className="text-xl font-extrabold text-indigo-600 font-mono">
              {formatBRL(futureCommitted.totalAll)}
            </span>
          </div>
        </div>

        {!futureCommitted.hasFuture ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-[12px] text-gray-400" style={{ borderColor: "#EDEDED" }}>
            Nenhum compromisso em parcelas futuras após o mês selecionado.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {futureCommitted.breakdown.map((item) => (
              <div
                key={item.competencia}
                className="rounded-xl border p-3.5 space-y-1 bg-gray-50/50"
                style={{ borderColor: "#EDEDED" }}
              >
                <div className="flex items-center justify-between text-[11px] text-gray-500 font-medium">
                  <span>Competência {item.competencia}</span>
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px]">
                    {item.count} parcela(s)
                  </span>
                </div>
                <div className="text-[15px] font-bold font-mono text-gray-900">
                  {formatBRL(item.total)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
