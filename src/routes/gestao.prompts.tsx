import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Copy, Check, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/gestao/prompts")({
  head: () => ({
    meta: [
      { title: "Prompts — Gestão — Rafael Leite" },
      { name: "description", content: "Biblioteca pessoal de prompts reutilizáveis." },
      { property: "og:title", content: "Prompts — Gestão" },
      { property: "og:description", content: "Biblioteca pessoal de prompts reutilizáveis." },
    ],
  }),
  component: PromptsPage,
});

type Prompt = {
  id: string;
  titulo: string;
  descricao: string | null;
  texto: string;
  criado_em: string;
};

const TRUNCATE_LINES = 4;

function PromptsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [texto, setTexto] = useState("");

  const { data: prompts = [], isLoading } = useQuery({
    queryKey: ["prompts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prompts")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data as Prompt[];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("prompts").insert({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        texto: texto.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitulo("");
      setDescricao("");
      setTexto("");
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["prompts"] });
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return prompts;
    return prompts.filter(
      (p) =>
        p.titulo.toLowerCase().includes(q) ||
        (p.descricao ?? "").toLowerCase().includes(q),
    );
  }, [prompts, search]);

  const canSave = titulo.trim().length > 0 && texto.trim().length > 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "#111111", letterSpacing: "-0.02em" }}
          >
            Prompts
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "#6B7280" }}>
            Biblioteca pessoal de prompts prontos para copiar e reutilizar.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#4F46E5" }}
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancelar" : "Novo prompt"}
        </button>
      </div>

      {showForm && (
        <div
          className="mt-4 rounded-2xl border bg-white p-4"
          style={{ borderColor: "#EDEDED" }}
        >
          <div className="flex flex-col gap-3">
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título"
              className="w-full rounded-lg border px-3 py-2 text-[14px] outline-none focus:border-[#4F46E5]"
              style={{ borderColor: "#EDEDED", color: "#111111" }}
            />
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição (opcional)"
              className="w-full rounded-lg border px-3 py-2 text-[14px] outline-none focus:border-[#4F46E5]"
              style={{ borderColor: "#EDEDED", color: "#111111" }}
            />
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Texto do prompt"
              rows={8}
              className="w-full resize-y rounded-lg border px-3 py-2 text-[14px] outline-none focus:border-[#4F46E5]"
              style={{ borderColor: "#EDEDED", color: "#111111", backgroundColor: "#FAFAFA" }}
            />
            <div className="flex justify-end">
              <button
                disabled={!canSave || createMut.isPending}
                onClick={() => createMut.mutate()}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: "#4F46E5" }}
              >
                {createMut.isPending ? "Salvando..." : "Salvar prompt"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título ou descrição..."
          className="w-full rounded-full border bg-white px-4 py-2.5 text-[14px] outline-none focus:border-[#4F46E5]"
          style={{ borderColor: "#EDEDED", color: "#111111" }}
        />
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {isLoading ? (
          <p className="py-8 text-center text-[13px]" style={{ color: "#6B7280" }}>
            Carregando...
          </p>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-[13px]" style={{ color: "#6B7280" }}>
            {prompts.length === 0
              ? "Nenhum prompt salvo ainda. Crie o primeiro!"
              : "Nenhum prompt encontrado para essa busca."}
          </p>
        ) : (
          filtered.map((p) => <PromptCard key={p.id} prompt={p} />)
        )}
      </div>
    </div>
  );
}

function PromptCard({ prompt }: { prompt: Prompt }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const lineCount = prompt.texto.split("\n").length;
  const isLong = lineCount > TRUNCATE_LINES || prompt.texto.length > 320;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.texto);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // no-op
    }
  };

  return (
    <div
      className="rounded-2xl border bg-white p-4"
      style={{ borderColor: "#EDEDED" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3
            className="text-[15px] font-bold"
            style={{ color: "#111111", letterSpacing: "-0.01em" }}
          >
            {prompt.titulo}
          </h3>
          {prompt.descricao && (
            <p className="mt-0.5 text-[13px]" style={{ color: "#6B7280" }}>
              {prompt.descricao}
            </p>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
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

      <div
        className="mt-3 rounded-lg border px-3 py-2.5 text-[13px] whitespace-pre-wrap break-words"
        style={{
          backgroundColor: "#FAFAFA",
          borderColor: "#EDEDED",
          color: "#111111",
          maxHeight: expanded ? undefined : `${TRUNCATE_LINES * 1.5}em`,
          overflow: "hidden",
        }}
      >
        {prompt.texto}
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-[12px] font-medium"
          style={{ color: "#4F46E5" }}
        >
          {expanded ? "Ver menos" : "Ver mais"}
        </button>
      )}
    </div>
  );
}
