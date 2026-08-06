import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { Copy, Check, Plus, X, Pencil, Trash2, Search, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TAB_AREAS, type TabArea } from "@/lib/areas";
import { toast } from "sonner";

export const Route = createFileRoute("/$area/protocolos")({
  head: ({ loaderData }) => {
    const areaLabel = loaderData?.areaLabel ?? "Protocolos";
    return {
      meta: [
        { title: `Protocolos — ${areaLabel} — Rafael Leite` },
        { name: "description", content: `Protocolos clínicos e de gestão para ${areaLabel}.` },
        { property: "og:title", content: `Protocolos — ${areaLabel}` },
        { property: "og:description", content: `Protocolos clínicos e de gestão para ${areaLabel}.` },
      ],
    };
  },
  loader: ({ params }) => {
    const area = TAB_AREAS.find((a) => a.slug === params.area);
    return { 
      areaSlug: params.area as TabArea, 
      areaLabel: area?.label ?? params.area 
    };
  },
  component: ProtocolosPage,
});

type Protocolo = {
  id: string;
  tipo: "clinico" | "gestao";
  titulo: string;
  descricao: string | null;
  conteudo: string;
  area: string;
  criado_em: string;
};

function ProtocolosPage() {
  const { areaSlug, areaLabel } = Route.useLoaderData();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<"todos" | "clinico" | "gestao">("todos");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Rules for types based on area
  const isMedicalArea = areaSlug === "consultorio" || areaSlug === "especializacao";
  
  const [tipo, setTipo] = useState<"clinico" | "gestao">("gestao");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isMedicalArea) {
      setTipo("gestao");
      setFilterTipo("todos");
    }
  }, [isMedicalArea]);

  const { data: protocolos = [], isLoading } = useQuery({
    queryKey: ["protocolos", areaSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("protocolos" as any)
        .select("*")
        .eq("area", areaLabel)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data as any) as Protocolo[];
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      setFormError(null);
      const payload = {
        tipo: isMedicalArea ? tipo : "gestao",
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        conteudo: conteudo.trim(),
        area: areaLabel,
      };

      if (editingId) {
        const { error } = await supabase
          .from("protocolos" as any)
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("protocolos" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Protocolo atualizado!" : "Protocolo criado!");
      cancelForm();
      qc.invalidateQueries({ queryKey: ["protocolos", areaSlug] });
    },
    onError: (error: any) => {
      console.error("Erro ao salvar protocolo:", error);
      setFormError(error.message || "Erro desconhecido ao salvar. Verifique se todos os campos estão preenchidos.");
    }
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("protocolos" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Protocolo excluído!");
      qc.invalidateQueries({ queryKey: ["protocolos", areaSlug] });
    },
    onError: (error: any) => {
      toast.error("Erro ao excluir: " + error.message);
    }
  });

  const startEdit = (p: Protocolo) => {
    setEditingId(p.id);
    setTipo(p.tipo);
    setTitulo(p.titulo);
    setDescricao(p.descricao ?? "");
    setConteudo(p.conteudo);
    setShowForm(true);
    setFormError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setTitulo("");
    setDescricao("");
    setConteudo("");
    setTipo(isMedicalArea ? "clinico" : "gestao");
    setFormError(null);
  };

  const filtered = useMemo(() => {
    let result = protocolos;
    
    if (isMedicalArea && filterTipo !== "todos") {
      result = result.filter(p => p.tipo === filterTipo);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (p) =>
          p.titulo.toLowerCase().includes(q) ||
          (p.descricao ?? "").toLowerCase().includes(q)
      );
    }
    
    return result;
  }, [protocolos, search, filterTipo, isMedicalArea]);

  const canSave = titulo.trim().length > 0 && conteudo.trim().length > 0;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#111111", letterSpacing: "-0.02em" }}>
            Protocolos
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "#6B7280" }}>
            Passo a passo e fluxos de gestão para {areaLabel}.
          </p>
        </div>
        <button
          onClick={() => (showForm ? cancelForm() : setShowForm(true))}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#4F46E5" }}
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancelar" : "Novo protocolo"}
        </button>
      </div>

      {showForm && (
        <div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: "#EDEDED" }}>
          <div className="flex flex-col gap-4">
            {isMedicalArea && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold uppercase tracking-wider text-gray-400">Tipo de Protocolo</label>
                <div className="flex gap-2">
                  {(["clinico", "gestao"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTipo(t)}
                      className="flex-1 rounded-lg border py-2 text-[13px] font-medium transition-colors"
                      style={{
                        borderColor: tipo === t ? "#4F46E5" : "#EDEDED",
                        backgroundColor: tipo === t ? "#4F46E5" : "transparent",
                        color: tipo === t ? "white" : "#6B7280",
                      }}
                    >
                      {t === "clinico" ? "Clínico" : "Gestão"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Título do protocolo"
                className="w-full rounded-lg border px-3 py-2 text-[14px] outline-none focus:border-[#4F46E5]"
                style={{ borderColor: "#EDEDED", color: "#111111" }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Resumo ou descrição curta (opcional)"
                className="w-full rounded-lg border px-3 py-2 text-[14px] outline-none focus:border-[#4F46E5]"
                style={{ borderColor: "#EDEDED", color: "#111111" }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <textarea
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                placeholder="Conteúdo completo do protocolo (passo a passo)..."
                rows={10}
                className="w-full resize-y rounded-lg border px-3 py-2 text-[14px] outline-none focus:border-[#4F46E5] font-mono"
                style={{ borderColor: "#EDEDED", color: "#111111", backgroundColor: "#FAFAFA" }}
              />
            </div>

            {formError && (
              <div className="flex items-center gap-2 p-3 text-[13px] text-red-600 bg-red-50 rounded-lg border border-red-100">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                disabled={!canSave || saveMut.isPending}
                onClick={() => saveMut.mutate()}
                className="inline-flex items-center gap-1.5 rounded-full px-6 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: "#4F46E5" }}
              >
                {saveMut.isPending ? "Salvando..." : editingId ? "Salvar alterações" : "Criar protocolo"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título ou descrição..."
            className="w-full rounded-full border bg-white pl-10 pr-4 py-2.5 text-[14px] outline-none focus:border-[#4F46E5]"
            style={{ borderColor: "#EDEDED", color: "#111111" }}
          />
        </div>
        {isMedicalArea && (
          <div className="flex gap-1 p-1 bg-white border rounded-full" style={{ borderColor: "#EDEDED" }}>
            {(["todos", "clinico", "gestao"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterTipo(t)}
                className="px-4 py-1.5 rounded-full text-[12px] font-medium transition-all"
                style={{
                  backgroundColor: filterTipo === t ? "#4F46E5" : "transparent",
                  color: filterTipo === t ? "white" : "#6B7280",
                }}
              >
                {t === "todos" ? "Todos" : t === "clinico" ? "Clínico" : "Gestão"}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4">
        {isLoading ? (
          <div className="py-12 text-center text-[13px] text-gray-500">Carregando protocolos...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-gray-500 rounded-2xl border border-dashed" style={{ borderColor: "#EDEDED" }}>
            {protocolos.length === 0 ? `Nenhum protocolo cadastrado em ${areaLabel}.` : "Nenhum protocolo encontrado para essa busca."}
          </div>
        ) : (
          filtered.map((p) => (
            <ProtocoloCard
              key={p.id}
              protocolo={p}
              onEdit={() => startEdit(p)}
              onDelete={() => {
                if (confirm(`Excluir o protocolo "${p.titulo}"?`)) {
                  deleteMut.mutate(p.id);
                }
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ProtocoloCard({
  protocolo,
  onEdit,
  onDelete,
}: {
  protocolo: Protocolo;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(protocolo.conteudo);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // no-op
    }
  };

  return (
    <div className="group rounded-2xl border bg-white p-5 transition-shadow hover:shadow-sm" style={{ borderColor: "#EDEDED" }}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span 
              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
              style={{ 
                backgroundColor: protocolo.tipo === "clinico" ? "#EEF2FF" : "#F3F4F6",
                color: protocolo.tipo === "clinico" ? "#4F46E5" : "#6B7280"
              }}
            >
              {protocolo.tipo === "clinico" ? "Clínico" : "Gestão"}
            </span>
          </div>
          <h3 className="text-[16px] font-bold leading-tight" style={{ color: "#111111" }}>
            {protocolo.titulo}
          </h3>
          {protocolo.descricao && (
            <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "#6B7280" }}>
              {protocolo.descricao}
            </p>
          )}
        </div>
        
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={onEdit}
            className="rounded-full p-2 transition-colors hover:bg-gray-50"
            style={{ color: "#9CA3AF" }}
            title="Editar"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="rounded-full p-2 transition-colors hover:bg-red-50 hover:text-red-500"
            style={{ color: "#9CA3AF" }}
            title="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-medium text-white transition-all active:scale-95"
            style={{ backgroundColor: copied ? "#10B981" : "#4F46E5" }}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copiar
              </>
            )}
          </button>
        </div>
      </div>

      <div
        className="mt-4 rounded-xl border p-4 text-[13px] whitespace-pre-wrap break-words font-mono overflow-hidden transition-all duration-300"
        style={{
          backgroundColor: "#FAFAFA",
          borderColor: "#EDEDED",
          color: "#374151",
          maxHeight: expanded ? "none" : "120px",
          position: "relative"
        }}
      >
        {protocolo.conteudo}
        {!expanded && protocolo.conteudo.length > 200 && (
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#FAFAFA] to-transparent pointer-events-none" />
        )}
      </div>
      
      {protocolo.conteudo.length > 200 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-[12px] font-semibold hover:underline"
          style={{ color: "#4F46E5" }}
        >
          {expanded ? "Ver menos" : "Ver conteúdo completo"}
        </button>
      )}
    </div>
  );
}
