import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type TarefaItem = {
  id: string;
  dia_mes: number;
  descricao: string;
};

type TarefaRegistro = {
  id: string;
  item_id: string;
  mes: number;
  ano: number;
  feito: boolean;
};

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function TarefasRecorrentesMensal() {
  const ano = new Date().getFullYear();
  const mesAtual = new Date().getMonth() + 1; // 1..12
  const qc = useQueryClient();

  const [novoDia, setNovoDia] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const { data: items, isLoading: loadingItems } = useQuery<TarefaItem[]>({
    queryKey: ["tarefas_recorrentes_mensal_item"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas_recorrentes_mensal_item")
        .select("id, dia_mes, descricao")
        .order("dia_mes", { ascending: true })
        .order("descricao", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TarefaItem[];
    },
  });

  const { data: registros, isLoading: loadingReg } = useQuery<TarefaRegistro[]>({
    queryKey: ["tarefas_recorrentes_mensal_registro", ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas_recorrentes_mensal_registro")
        .select("id, item_id, mes, ano, feito")
        .eq("ano", ano);
      if (error) throw error;
      return (data ?? []) as TarefaRegistro[];
    },
  });

  const registroMap = useMemo(() => {
    const m = new Map<string, TarefaRegistro>();
    for (const r of registros ?? []) {
      m.set(`${r.item_id}:${r.mes}`, r);
    }
    return m;
  }, [registros]);

  const toggleMutation = useMutation({
    mutationFn: async (input: { item_id: string; mes: number }) => {
      const key = `${input.item_id}:${input.mes}`;
      const existing = registroMap.get(key);
      if (existing) {
        const { error } = await supabase
          .from("tarefas_recorrentes_mensal_registro")
          .update({ feito: !existing.feito } as never)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tarefas_recorrentes_mensal_registro")
          .insert({
            item_id: input.item_id,
            mes: input.mes,
            ano,
            feito: true,
          } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tarefas_recorrentes_mensal_registro", ano] });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async () => {
      const dia = parseInt(novoDia);
      if (isNaN(dia) || dia < 1 || dia > 31) throw new Error("Dia inválido");
      if (!novaDescricao.trim()) throw new Error("Descrição vazia");

      const { error } = await supabase.from("tarefas_recorrentes_mensal_item").insert({
        dia_mes: dia,
        descricao: novaDescricao.trim(),
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      setNovoDia("");
      setNovaDescricao("");
      setIsAdding(false);
      qc.invalidateQueries({ queryKey: ["tarefas_recorrentes_mensal_item"] });
    },
  });

  if (loadingItems || loadingReg) {
    return <div className="py-10 text-center text-[13px] text-[#B0B4BC]">Carregando...</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Formulário Adicionar Item */}
      <div className="rounded-2xl border bg-white p-5" style={{ borderColor: "#EDEDED" }}>
        {!isAdding ? (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 text-[13px] font-medium text-[#4F46E5] hover:opacity-80"
          >
            <Plus className="h-4 w-4" />
            Adicionar novo item
          </button>
        ) : (
          <div className="flex flex-col gap-4">
            <h3 className="text-[14px] font-semibold text-[#111111]">Novo Item Recorrente</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="sm:col-span-1">
                <label className="mb-1 block text-[11px] font-semibold uppercase text-[#6B7280]">Dia (1-31)</label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={novoDia}
                  onChange={(e) => setNovoDia(e.target.value)}
                  placeholder="Ex: 5"
                  className="h-9 text-[13px]"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="mb-1 block text-[11px] font-semibold uppercase text-[#6B7280]">Descrição</label>
                <Input
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                  placeholder="Ex: Mandar email..."
                  className="h-9 text-[13px]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => addItemMutation.mutate()}
                disabled={addItemMutation.isPending}
                className="bg-[#4F46E5] text-white hover:bg-[#4F46E5]/90"
              >
                Salvar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsAdding(false)}
                className="text-[#6B7280]"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Grade Mensal */}
      {!items || items.length === 0 ? (
        <div className="rounded-2xl border py-10 text-center text-[13px] text-[#B0B4BC]" style={{ borderColor: "#EDEDED" }}>
          Nenhuma tarefa recorrente mensal cadastrada.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-white" style={{ borderColor: "#EDEDED" }}>
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
                  Tarefa
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
              {items.map((item) => (
                <tr key={item.id}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-b border-r bg-white px-3 py-2 text-left font-normal"
                    style={{ borderColor: "#EDEDED" }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                        style={{ backgroundColor: "#F3F4F6", color: "#111111" }}
                      >
                        {item.dia_mes}
                      </span>
                      <span style={{ color: "#111111" }}>{item.descricao}</span>
                    </div>
                  </th>
                  {MESES.map((_, idx) => {
                    const mesNum = idx + 1;
                    const reg = registroMap.get(`${item.id}:${mesNum}`);
                    const feito = reg?.feito ?? false;
                    const isPast = mesNum < mesAtual;
                    const isMissed = isPast && !feito;

                    return (
                      <td
                        key={mesNum}
                        className="border-b border-r px-2 py-2 align-middle"
                        style={{
                          borderColor: "#EDEDED",
                          backgroundColor: isMissed ? "#FEF3F3" : "transparent",
                        }}
                      >
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => toggleMutation.mutate({ item_id: item.id, mes: mesNum })}
                            disabled={toggleMutation.isPending}
                            className="inline-flex items-center justify-center rounded-full border px-3 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider transition-colors disabled:opacity-60"
                            style={
                              feito
                                ? { backgroundColor: "#4F46E5", borderColor: "#4F46E5", color: "#FFFFFF" }
                                : { backgroundColor: "#FFFFFF", borderColor: "#EDEDED", color: "#6B7280" }
                            }
                          >
                            Done
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
