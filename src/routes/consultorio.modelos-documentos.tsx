import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Copy, Check, Plus, X, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/consultorio/modelos-documentos")({
  head: () => ({
    meta: [
      { title: "Modelos de Documentos — Consultório — Rafael Leite" },
      { name: "description", content: "Modelos de encaminhamentos, atestados, declarações e receituários." },
      { property: "og:title", content: "Modelos de Documentos — Consultório" },
      { property: "og:description", content: "Modelos de encaminhamentos, atestados, declarações e receituários." },
    ],
  }),
  component: ModelosDocumentosPage,
});

type TipoDoc = "encaminhamento" | "atestado" | "declaracao" | "receituario";

type Modelo = {
  id: string;
  tipo: TipoDoc;
  nome: string;
  conteudo: string;
  ativo: boolean;
  ordem: number;
  criado_em: string;
};

const TIPO_LABEL: Record<TipoDoc, string> = {
  encaminhamento: "Encaminhamento",
  atestado: "Atestado",
  declaracao: "Declaração",
  receituario: "Receituário",
};

const TIPOS: TipoDoc[] = ["encaminhamento", "atestado", "declaracao", "receituario"];

function extractPlaceholders(text: string): string[] {
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      out.push(m[1]);
    }
  }
  return out;
}

function humanLabel(key: string): string {
  const s = key.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function renderTemplate(template: string, values: Record<string, string>): string {
  let result = template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    return values[key] ?? "";
  });
  // Clean up spacing artifacts, especially from empty {{repouso}} before punctuation.
  result = result.replace(/[ \t]+([.,;:!?])/g, "$1");
  result = result.replace(/[ \t]{2,}/g, " ");
  return result;
}

function ModelosDocumentosPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Modelo | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoTipo, setNovoTipo] = useState<TipoDoc>("encaminhamento");
  const [novoConteudo, setNovoConteudo] = useState("");

  const { data: modelos = [], isLoading } = useQuery({
    queryKey: ["documento_modelos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documento_modelos")
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data as Modelo[];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const maxOrdem = modelos.reduce((m, x) => Math.max(m, x.ordem), 0);
      const { error } = await supabase.from("documento_modelos").insert({
        nome: novoNome.trim(),
        tipo: novoTipo,
        conteudo: novoConteudo,
        ordem: maxOrdem + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNovoNome("");
      setNovoConteudo("");
      setNovoTipo("encaminhamento");
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["documento_modelos"] });
    },
  });

  const canSave = novoNome.trim().length > 0;

  if (selected) {
    return <UsarModelo modelo={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "#111111", letterSpacing: "-0.02em" }}
          >
            Modelos de Documentos
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "#6B7280" }}>
            Encaminhamentos, atestados, declarações e receituários prontos para preencher.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#4F46E5" }}
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancelar" : "Novo modelo"}
        </button>
      </div>

      {showForm && (
        <div
          className="mt-4 rounded-2xl border bg-white p-4"
          style={{ borderColor: "#EDEDED" }}
        >
          <div className="flex flex-col gap-3">
            <input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Nome"
              className="w-full rounded-lg border px-3 py-2 text-[14px] outline-none focus:border-[#4F46E5]"
              style={{ borderColor: "#EDEDED", color: "#111111" }}
            />
            <select
              value={novoTipo}
              onChange={(e) => setNovoTipo(e.target.value as TipoDoc)}
              className="w-full rounded-lg border bg-white px-3 py-2 text-[14px] outline-none focus:border-[#4F46E5]"
              style={{ borderColor: "#EDEDED", color: "#111111" }}
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {TIPO_LABEL[t]}
                </option>
              ))}
            </select>
            <textarea
              value={novoConteudo}
              onChange={(e) => setNovoConteudo(e.target.value)}
              placeholder="Conteúdo — use marcadores como {{paciente}}, {{data}}, etc."
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
                {createMut.isPending ? "Salvando..." : "Salvar modelo"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {isLoading ? (
          <p className="py-8 text-center text-[13px]" style={{ color: "#6B7280" }}>
            Carregando...
          </p>
        ) : modelos.length === 0 ? (
          <p className="py-8 text-center text-[13px]" style={{ color: "#6B7280" }}>
            Nenhum modelo ainda. Crie o primeiro!
          </p>
        ) : (
          modelos.map((m) => (
            <ModeloCard key={m.id} modelo={m} onUse={() => setSelected(m)} />
          ))
        )}
      </div>
    </div>
  );
}

function ModeloCard({ modelo, onUse }: { modelo: Modelo; onUse: () => void }) {
  return (
    <div
      className="rounded-2xl border bg-white p-4"
      style={{ borderColor: "#EDEDED" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ backgroundColor: "#F5F3FF", color: "#4F46E5" }}
            >
              {TIPO_LABEL[modelo.tipo]}
            </span>
          </div>
          <h3
            className="mt-1.5 text-[15px] font-bold"
            style={{ color: "#111111", letterSpacing: "-0.01em" }}
          >
            {modelo.nome}
          </h3>
          {modelo.conteudo && (
            <p
              className="mt-1.5 text-[12.5px] line-clamp-2"
              style={{ color: "#6B7280" }}
            >
              {modelo.conteudo}
            </p>
          )}
        </div>
        <button
          onClick={onUse}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#4F46E5" }}
        >
          Usar este modelo
        </button>
      </div>
    </div>
  );
}

function UsarModelo({ modelo, onBack }: { modelo: Modelo; onBack: () => void }) {
  const placeholders = useMemo(
    () => extractPlaceholders(modelo.conteudo),
    [modelo.conteudo],
  );
  const isFreeForm = modelo.conteudo.trim().length === 0;

  const [values, setValues] = useState<Record<string, string>>({});
  const [freeText, setFreeText] = useState("");
  const [copied, setCopied] = useState(false);

  const generated = useMemo(() => {
    if (isFreeForm) return freeText;
    return renderTemplate(modelo.conteudo, values);
  }, [isFreeForm, freeText, modelo.conteudo, values]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generated);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // no-op
    }
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-[12px] font-medium"
        style={{ borderColor: "#EDEDED", color: "#6B7280" }}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar aos modelos
      </button>

      <div className="flex flex-col gap-2">
        <span
          className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ backgroundColor: "#F5F3FF", color: "#4F46E5" }}
        >
          {TIPO_LABEL[modelo.tipo]}
        </span>
        <h1
          className="text-2xl font-bold"
          style={{ color: "#111111", letterSpacing: "-0.02em" }}
        >
          {modelo.nome}
        </h1>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div
          className="rounded-2xl border bg-white p-4"
          style={{ borderColor: "#EDEDED" }}
        >
          <h2
            className="text-[13px] font-semibold uppercase tracking-wider"
            style={{ color: "#6B7280", letterSpacing: "0.08em" }}
          >
            Campos
          </h2>

          {isFreeForm ? (
            <div className="mt-3">
              <label
                className="text-[12px] font-medium"
                style={{ color: "#111111" }}
              >
                Texto
              </label>
              <textarea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="Digite o conteúdo..."
                rows={12}
                className="mt-1 w-full resize-y rounded-lg border px-3 py-2 text-[14px] outline-none focus:border-[#4F46E5]"
                style={{ borderColor: "#EDEDED", color: "#111111", backgroundColor: "#FAFAFA" }}
              />
            </div>
          ) : placeholders.length === 0 ? (
            <p className="mt-3 text-[13px]" style={{ color: "#6B7280" }}>
              Este modelo não possui campos variáveis.
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              {placeholders.map((key) => {
                const isRepouso = key === "repouso";
                return (
                  <div key={key}>
                    <label
                      className="text-[12px] font-medium"
                      style={{ color: "#111111" }}
                    >
                      {humanLabel(key)}
                      {isRepouso && (
                        <span
                          className="ml-1.5 text-[11px] font-normal"
                          style={{ color: "#6B7280" }}
                        >
                          (opcional)
                        </span>
                      )}
                    </label>
                    <input
                      value={values[key] ?? ""}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [key]: e.target.value }))
                      }
                      placeholder={
                        isRepouso
                          ? "Deixe em branco para omitir"
                          : humanLabel(key)
                      }
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-[14px] outline-none focus:border-[#4F46E5]"
                      style={{ borderColor: "#EDEDED", color: "#111111" }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-[97px] lg:self-start">
          <div
            className="rounded-2xl border bg-white p-4"
            style={{ borderColor: "#EDEDED" }}
          >
            <div className="flex items-center justify-between gap-3">
              <h2
                className="text-[13px] font-semibold uppercase tracking-wider"
                style={{ color: "#6B7280", letterSpacing: "0.08em" }}
              >
                Texto gerado
              </h2>
              <button
                onClick={handleCopy}
                disabled={!generated.trim()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
                    Copiar texto
                  </>
                )}
              </button>
            </div>
            <div
              className="mt-3 min-h-[160px] rounded-lg border px-3 py-2.5 text-[14px] whitespace-pre-wrap break-words"
              style={{
                backgroundColor: "#FAFAFA",
                borderColor: "#EDEDED",
                color: "#111111",
              }}
            >
              {generated || (
                <span style={{ color: "#9CA3AF" }}>
                  Preencha os campos ao lado para gerar o texto.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
