import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

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

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPagamento, setEditingPagamento] = useState<Pagamento | null>(null);
  const [formDiaMes, setFormDiaMes] = useState("");
  const [formDescricao, setFormDescricao] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const savePagamento = useMutation({
    mutationFn: async () => {
      const dia = parseInt(formDiaMes);
      if (isNaN(dia) || dia < 1 || dia > 31) throw new Error("Dia inválido (1-31)");
      if (!formDescricao.trim()) throw new Error("Descrição obrigatória");

      if (editingPagamento) {
        const { error } = await supabase
          .from("pagamentos_recorrentes")
          .update({
            dia_mes: dia,
            descricao: formDescricao.trim(),
          })
          .eq("id", editingPagamento.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("pagamentos_recorrentes")
          .insert({
            dia_mes: dia,
            descricao: formDescricao.trim(),
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pagamentos_recorrentes"] });
      setIsDialogOpen(false);
      resetForm();
      toast.success(editingPagamento ? "Pagamento atualizado" : "Pagamento adicionado");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deletePagamento = useMutation({
    mutationFn: async (id: string) => {
      // Cascade delete: remover os registros mensais primeiro
      await supabase
        .from("pagamentos_recorrentes_registro")
        .delete()
        .eq("pagamento_id", id);
      
      const { error } = await supabase
        .from("pagamentos_recorrentes")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pagamentos_recorrentes"] });
      qc.invalidateQueries({ queryKey: ["pagamentos_recorrentes_registro"] });
      setIsDeleteDialogOpen(false);
      setDeletingId(null);
      toast.success("Pagamento removido");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setEditingPagamento(null);
    setFormDiaMes("");
    setFormDescricao("");
  };

  const handleEdit = (p: Pagamento) => {
    setEditingPagamento(p);
    setFormDiaMes(p.dia_mes.toString());
    setFormDescricao(p.descricao);
    setIsDialogOpen(true);
  };

  if (loadingPag || loadingReg) {
    return (
      <div className="py-10 text-center text-[13px]" style={{ color: "#B0B4BC" }}>
        Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button 
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
          className="bg-[#4F46E5] hover:bg-[#4338CA] text-white"
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar pagamento
        </Button>
      </div>

      {!pagamentos || pagamentos.length === 0 ? (
        <div
          className="rounded-2xl border py-10 text-center text-[13px]"
          style={{ borderColor: "#EDEDED", color: "#B0B4BC" }}
        >
          Nenhum pagamento recorrente cadastrado.
        </div>
      ) : (
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
                    <div className="flex items-center justify-between group">
                      <div 
                        className="flex items-center gap-2 cursor-pointer hover:bg-[#FAFAFA] p-1 rounded-md transition-colors flex-1"
                        onClick={() => handleEdit(p)}
                      >
                        <span
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                          style={{ backgroundColor: "#F3F4F6", color: "#111111" }}
                          title={`Dia ${p.dia_mes}`}
                        >
                          {p.dia_mes}
                        </span>
                        <span style={{ color: "#111111" }}>{p.descricao}</span>
                        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-40 ml-auto" />
                      </div>
                      <button
                        onClick={() => {
                          setDeletingId(p.id);
                          setIsDeleteDialogOpen(true);
                        }}
                        className="p-1 hover:text-red-500 text-gray-400 transition-colors ml-2"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
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
      )}

      {/* Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingPagamento ? "Editar Pagamento" : "Adicionar Pagamento"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="dia_mes">Dia do mês (1-31)</Label>
              <Input
                id="dia_mes"
                type="number"
                min="1"
                max="31"
                placeholder="Ex: 5"
                value={formDiaMes}
                onChange={(e) => setFormDiaMes(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Input
                id="descricao"
                placeholder="Ex: Aluguel"
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button 
              className="bg-[#4F46E5] hover:bg-[#4338CA] text-white"
              onClick={() => savePagamento.mutate()}
              disabled={savePagamento.isPending}
            >
              {savePagamento.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente o pagamento
              e todos os registros mensais associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white border-none"
              onClick={() => deletingId && deletePagamento.mutate(deletingId)}
            >
              {deletePagamento.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
