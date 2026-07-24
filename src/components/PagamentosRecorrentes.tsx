import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Pagamento = {
  id: string;
  dia_mes: number;
  descricao: string;
};

type Registro = {
  id: string;
  pagamento_id: string;
  mes: number;
  ano: number;
  impresso: boolean;
  pago: boolean;
};

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function usePagamentos() {
  return useQuery<Pagamento[]>({
    queryKey: ["pagamentos_recorrentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_recorrentes")
        .select("id, dia_mes, descricao")
        .order("dia_mes", { ascending: true })
        .order("descricao", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Pagamento[];
    },
  });
}

function useRegistros(ano: number) {
  return useQuery<Registro[]>({
    queryKey: ["pagamentos_recorrentes_registro", ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_recorrentes_registro")
        .select("id, pagamento_id, mes, ano, impresso, pago")
        .eq("ano", ano);
      if (error) throw error;
      return (data ?? []) as Registro[];
    },
  });
}

export function PagamentosRecorrentes() {
  const ano = new Date().getFullYear();
  const mesAtual = new Date().getMonth() + 1; // 1..12
  const { data: pagamentos, isLoading: loadingPag } = usePagamentos();
  const { data: registros, isLoading: loadingReg } = useRegistros(ano);
  const qc = useQueryClient();

  const registroMap = useMemo(() => {
    const m = new Map<string, Registro>();
    for (const r of registros ?? []) {
      m.set(`${r.pagamento_id}:${r.mes}`, r);
    }
    return m;
  }, [registros]);

  const toggle = useMutation({
    mutationFn: async (input: {
      pagamento_id: string;
      mes: number;
      field: "impresso" | "pago";
    }) => {
      const key = `${input.pagamento_id}:${input.mes}`;
      const existing = registroMap.get(key);
      if (existing) {
        const patch =
          input.field === "impresso"
            ? { impresso: !existing.impresso, atualizado_em: new Date().toISOString() }
            : { pago: !existing.pago, atualizado_em: new Date().toISOString() };
        const { error } = await supabase
          .from("pagamentos_recorrentes_registro")
          .update(patch)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("pagamentos_recorrentes_registro")
          .insert({
            pagamento_id: input.pagamento_id,
            mes: input.mes,
            ano,
            impresso: input.field === "impresso",
            pago: input.field === "pago",
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pagamentos_recorrentes_registro", ano] });
    },
  });

  if (loadingPag || loadingReg) {
    return (
      <div className="py-10 text-center text-[13px]" style={{ color: "#B0B4BC" }}>
        Carregando...
      </div>
    );
  }

  if (!pagamentos || pagamentos.length === 0) {
    return (
      <div
        className="rounded-2xl border py-10 text-center text-[13px]"
        style={{ borderColor: "#EDEDED", color: "#B0B4BC" }}
      >
        Nenhum pagamento recorrente cadastrado.
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto rounded-2xl border bg-white"
      style={{ borderColor: "#EDEDED" }}
    >
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr style={{ backgroundColor: "#FAFAFA" }}>
            <th
              className="sticky left-0 z-10 border-b border-r px-3 py-2.5 text-left font-semibold"
              style={{
                backgroundColor: "#FAFAFA",
                borderColor: "#EDEDED",
                color: "#111111",
                minWidth: 240,
              }}
            >
              Pagamento
            </th>
            {MESES.map((m, idx) => {
              const mesNum = idx + 1;
              const isCurrent = mesNum === mesAtual;
              return (
                <th
                  key={m}
                  className="border-b border-r px-2 py-2.5 text-center font-semibold"
                  style={{
                    borderColor: "#EDEDED",
                    color: isCurrent ? "#4F46E5" : "#6B7280",
                    minWidth: 84,
                  }}
                >
                  {m}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {pagamentos.map((p) => (
            <tr key={p.id}>
              <th
                scope="row"
                className="sticky left-0 z-10 border-b border-r bg-white px-3 py-2 text-left font-normal"
                style={{ borderColor: "#EDEDED" }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                    style={{ backgroundColor: "#F3F4F6", color: "#111111" }}
                    title={`Dia ${p.dia_mes}`}
                  >
                    {p.dia_mes}
                  </span>
                  <span style={{ color: "#111111" }}>{p.descricao}</span>
                </div>
              </th>
              {MESES.map((_, idx) => {
                const mesNum = idx + 1;
                const reg = registroMap.get(`${p.id}:${mesNum}`);
                const impresso = reg?.impresso ?? false;
                const pago = reg?.pago ?? false;
                const isPast = mesNum < mesAtual;
                const isMissed = isPast && !impresso && !pago;

                return (
                  <td
                    key={mesNum}
                    className="border-b border-r px-2 py-2 align-middle"
                    style={{
                      borderColor: "#EDEDED",
                      backgroundColor: isMissed ? "#FEF3F3" : "transparent",
                    }}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <MarkerButton
                        label="Imp"
                        active={impresso}
                        disabled={toggle.isPending}
                        onClick={() =>
                          toggle.mutate({ pagamento_id: p.id, mes: mesNum, field: "impresso" })
                        }
                      />
                      <MarkerButton
                        label="Pago"
                        active={pago}
                        disabled={toggle.isPending}
                        onClick={() =>
                          toggle.mutate({ pagamento_id: p.id, mes: mesNum, field: "pago" })
                        }
                      />
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarkerButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider transition-colors disabled:opacity-60"
      style={
        active
          ? { backgroundColor: "#4F46E5", borderColor: "#4F46E5", color: "#FFFFFF" }
          : { backgroundColor: "#FFFFFF", borderColor: "#EDEDED", color: "#6B7280" }
      }
      aria-pressed={active}
      aria-label={`${label} ${active ? "marcado" : "não marcado"}`}
    >
      {label}
    </button>
  );
}
