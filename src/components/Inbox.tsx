import { useState, useMemo } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ALL_AREA_OPTIONS, areaLabel, type AreaValue } from "@/lib/areas";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Tipo = "mensagem" | "ideia" | "tarefa";

export type InboxItem = {
  id: string;
  texto: string;
  tipo: Tipo;
  area: AreaValue;
  concluido: boolean;
  criado_em: string;
};

const TIPO_OPTIONS: { value: Tipo; label: string }[] = [
  { value: "mensagem", label: "Mensagem" },
  { value: "ideia", label: "Ideia" },
  { value: "tarefa", label: "Tarefa" },
];

function tipoDot(tipo: Tipo): string {
  if (tipo === "tarefa") return "#4F46E5";
  if (tipo === "ideia") return "#B0B4BC";
  return "#6B7280";
}

export function InboxForm({ defaultArea }: { defaultArea?: AreaValue }) {
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<Tipo | "">("");
  const [area, setArea] = useState<AreaValue | "">(defaultArea ?? "");

  const canSubmit = texto.trim().length > 0 && tipo !== "" && area !== "";

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("inbox_items").insert({
        texto: texto.trim(),
        tipo: tipo as Tipo,
        area: area as AreaValue,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTexto("");
      setTipo("");
      if (!defaultArea) setArea("");
      qc.invalidateQueries({ queryKey: ["inbox_items"] });
    },
  });

  return (
    <div
      className="rounded-2xl border bg-white p-5"
      style={{ borderColor: "#EDEDED" }}
    >
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Escreva uma mensagem, ideia ou tarefa..."
        rows={Math.min(6, Math.max(2, texto.split("\n").length))}
        className="w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-[color:#B0B4BC]"
        style={{ color: "#111111" }}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          {TIPO_OPTIONS.map((opt) => {
            const active = tipo === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTipo(opt.value)}
                className="rounded-full px-3 py-1 text-[12px] font-medium transition-colors"
                style={
                  active
                    ? { backgroundColor: "#4F46E5", color: "#FFFFFF" }
                    : { backgroundColor: "#FAFAFA", color: "#6B7280" }
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="min-w-[180px]">
          <Select
            value={area || undefined}
            onValueChange={(v) => setArea(v as AreaValue)}
            disabled={!!defaultArea}
          >
            <SelectTrigger className="h-9 rounded-full border-[#EDEDED] bg-[#FAFAFA] text-[13px]">
              <SelectValue placeholder="Selecionar área" />
            </SelectTrigger>
            <SelectContent>
              {ALL_AREA_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto">
          <button
            type="button"
            disabled={!canSubmit || addMutation.isPending}
            onClick={() => addMutation.mutate()}
            className="rounded-full px-5 py-2 text-[13px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: "#4F46E5" }}
          >
            {addMutation.isPending ? "Adicionando..." : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function InboxList({
  areaFilter,
  emptyLabel = "Nenhum item ainda.",
}: {
  areaFilter?: AreaValue;
  emptyLabel?: string;
}) {
  const qc = useQueryClient();
  const [showConcluidos, setShowConcluidos] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["inbox_items", areaFilter ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("inbox_items")
        .select("*")
        .order("criado_em", { ascending: false });
      if (areaFilter) query = query.eq("area", areaFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data as InboxItem[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (item: InboxItem) => {
      const { error } = await supabase
        .from("inbox_items")
        .update({ concluido: !item.concluido })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["inbox_items"] }),
  });

  const visible = useMemo(() => {
    if (!data) return [];
    return showConcluidos ? data : data.filter((i) => !i.concluido);
  }, [data, showConcluidos]);

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2
          className="text-[13px] font-semibold uppercase tracking-wider"
          style={{ color: "#6B7280" }}
        >
          {areaFilter ? "Itens desta área" : "Todos os itens"}
        </h2>
        <label
          className="flex cursor-pointer items-center gap-2 text-[12px]"
          style={{ color: "#6B7280" }}
        >
          <input
            type="checkbox"
            checked={showConcluidos}
            onChange={(e) => setShowConcluidos(e.target.checked)}
            className="h-3.5 w-3.5 accent-[#4F46E5]"
          />
          Mostrar concluídos
        </label>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-[13px]" style={{ color: "#B0B4BC" }}>
          Carregando...
        </div>
      ) : visible.length === 0 ? (
        <div
          className="rounded-2xl border py-10 text-center text-[13px]"
          style={{ borderColor: "#EDEDED", color: "#B0B4BC" }}
        >
          {emptyLabel}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 rounded-xl border bg-white px-4 py-3 transition-opacity"
              style={{
                borderColor: "#EDEDED",
                opacity: item.concluido ? 0.5 : 1,
              }}
            >
              <div className="pt-0.5">
                <Checkbox
                  checked={item.concluido}
                  onCheckedChange={() => toggleMutation.mutate(item)}
                />
              </div>
              <span
                className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: tipoDot(item.tipo) }}
                aria-label={item.tipo}
              />
              <div className="min-w-0 flex-1">
                <p
                  className="whitespace-pre-wrap break-words text-[14px]"
                  style={{
                    color: "#111111",
                    textDecoration: item.concluido ? "line-through" : "none",
                  }}
                >
                  {item.texto}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                  <span
                    className="rounded-full px-2 py-0.5 font-medium capitalize"
                    style={{ backgroundColor: "#FAFAFA", color: "#6B7280" }}
                  >
                    {item.tipo}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 font-medium"
                    style={{
                      backgroundColor: "#EEF0FF",
                      color: "#4F46E5",
                    }}
                  >
                    {areaLabel(item.area)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
