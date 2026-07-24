import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Copy, Check, Plus, X, ArrowLeft, Upload, Trash2 } from "lucide-react";
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

type ConfigTimbre = {
  id: string;
  logo_url: string | null;
  cabecalho_texto: string | null;
  rodape_texto: string | null;
  mostrar_timbre: boolean;
  usar_papel_timbrado: boolean;
};

const TIPO_LABEL: Record<TipoDoc, string> = {
  encaminhamento: "Encaminhamento",
  atestado: "Atestado",
  declaracao: "Declaração",
  receituario: "Receituário",
};

const TIPOS: TipoDoc[] = ["encaminhamento", "atestado", "declaracao", "receituario"];

const TIMBRE_BUCKET = "documento-timbre";
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10; // 10 anos

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
  result = result.replace(/[ \t]+([.,;:!?])/g, "$1");
  result = result.replace(/[ \t]{2,}/g, " ");
  return result;
}

type Tab = "modelos" | "timbre";

function ModelosDocumentosPage() {
  const [tab, setTab] = useState<Tab>("modelos");

  return (
    <div>
      <div className="mb-6 flex gap-1 rounded-full border bg-white p-1 w-fit" style={{ borderColor: "#EDEDED" }}>
        <TabButton active={tab === "modelos"} onClick={() => setTab("modelos")}>
          Modelos
        </TabButton>
        <TabButton active={tab === "timbre"} onClick={() => setTab("timbre")}>
          Configuração do timbre
        </TabButton>
      </div>

      {tab === "modelos" ? <ModelosTab /> : <TimbreTab />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors"
      style={
        active
          ? { backgroundColor: "#4F46E5", color: "#FFFFFF" }
          : { backgroundColor: "transparent", color: "#6B7280" }
      }
    >
      {children}
    </button>
  );
}

// ============================================================
// MODELOS TAB
// ============================================================

function ModelosTab() {
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

// ============================================================
// CONFIG HOOK
// ============================================================

function useConfigTimbre() {
  return useQuery({
    queryKey: ["configuracao_documentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracao_documentos")
        .select("*")
        .order("criado_em", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ConfigTimbre | null;
    },
  });
}

function useSignedLogoUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return;
    }
    // If it already looks like a URL, use as-is
    if (/^https?:\/\//i.test(path)) {
      setUrl(path);
      return;
    }
    supabase.storage
      .from(TIMBRE_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  return url;
}

// ============================================================
// USAR MODELO (integrated with timbre)
// ============================================================

function UsarModelo({ modelo, onBack }: { modelo: Modelo; onBack: () => void }) {
  const placeholders = useMemo(
    () => extractPlaceholders(modelo.conteudo),
    [modelo.conteudo],
  );
  const isFreeForm = modelo.conteudo.trim().length === 0;

  const [values, setValues] = useState<Record<string, string>>({});
  const [freeText, setFreeText] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: config } = useConfigTimbre();
  const logoUrl = useSignedLogoUrl(config?.logo_url ?? null);

  const bodyText = useMemo(() => {
    if (isFreeForm) return freeText;
    return renderTemplate(modelo.conteudo, values);
  }, [isFreeForm, freeText, modelo.conteudo, values]);

  const showTimbre = !!config?.mostrar_timbre && !config?.usar_papel_timbrado;

  const generated = useMemo(() => {
    if (!showTimbre) return bodyText;
    const parts: string[] = [];
    if (config?.cabecalho_texto && config.cabecalho_texto.trim()) {
      parts.push(config.cabecalho_texto.trim());
    }
    if (bodyText.trim()) parts.push(bodyText);
    if (config?.rodape_texto && config.rodape_texto.trim()) {
      parts.push(config.rodape_texto.trim());
    }
    return parts.join("\n\n");
  }, [showTimbre, bodyText, config?.cabecalho_texto, config?.rodape_texto]);

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

            {showTimbre && logoUrl && (
              <div className="mt-3 flex justify-center rounded-lg border p-3" style={{ borderColor: "#EDEDED", backgroundColor: "#FAFAFA" }}>
                <img src={logoUrl} alt="Logo" className="max-h-20 object-contain" />
              </div>
            )}

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

            {!showTimbre && (config?.usar_papel_timbrado || config) && (
              <p className="mt-2 text-[11.5px]" style={{ color: "#6B7280" }}>
                {config?.usar_papel_timbrado
                  ? "Papel timbrado físico ativo — o texto sai limpo, sem cabeçalho/rodapé."
                  : "Timbre digital desativado."}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TIMBRE TAB
// ============================================================

function TimbreTab() {
  const qc = useQueryClient();
  const { data: config, isLoading } = useConfigTimbre();

  const [cabecalho, setCabecalho] = useState("");
  const [rodape, setRodape] = useState("");
  const [mostrarTimbre, setMostrarTimbre] = useState(true);
  const [usarPapel, setUsarPapel] = useState(false);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate local state when config arrives
  useEffect(() => {
    if (!config) return;
    setCabecalho(config.cabecalho_texto ?? "");
    setRodape(config.rodape_texto ?? "");
    setMostrarTimbre(config.mostrar_timbre);
    setUsarPapel(config.usar_papel_timbrado);
    setLogoPath(config.logo_url);
  }, [config?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const logoUrl = useSignedLogoUrl(logoPath);

  const upsertMut = useMutation({
    mutationFn: async (patch: Partial<ConfigTimbre>) => {
      if (!config) {
        const { error } = await supabase
          .from("configuracao_documentos")
          .insert({
            cabecalho_texto: cabecalho || null,
            rodape_texto: rodape || null,
            mostrar_timbre: mostrarTimbre,
            usar_papel_timbrado: usarPapel,
            logo_url: logoPath,
            ...patch,
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("configuracao_documentos")
          .update(patch)
          .eq("id", config.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["configuracao_documentos"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleToggleTimbre = (val: boolean) => {
    setMostrarTimbre(val);
    if (val) setUsarPapel(false);
    upsertMut.mutate({
      mostrar_timbre: val,
      usar_papel_timbrado: val ? false : usarPapel,
    });
  };

  const handleTogglePapel = (val: boolean) => {
    setUsarPapel(val);
    if (val) setMostrarTimbre(false);
    upsertMut.mutate({
      usar_papel_timbrado: val,
      mostrar_timbre: val ? false : mostrarTimbre,
    });
  };

  const handleSaveTexts = () => {
    upsertMut.mutate({
      cabecalho_texto: cabecalho.trim() ? cabecalho : null,
      rodape_texto: rodape.trim() ? rodape : null,
    });
  };

  const handleUpload = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(TIMBRE_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      // Delete old logo if any
      if (logoPath && !/^https?:\/\//i.test(logoPath)) {
        await supabase.storage.from(TIMBRE_BUCKET).remove([logoPath]);
      }
      setLogoPath(path);
      upsertMut.mutate({ logo_url: path });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar logo");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    setError(null);
    try {
      if (logoPath && !/^https?:\/\//i.test(logoPath)) {
        await supabase.storage.from(TIMBRE_BUCKET).remove([logoPath]);
      }
      setLogoPath(null);
      upsertMut.mutate({ logo_url: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao remover logo");
    }
  };

  if (isLoading) {
    return (
      <p className="py-8 text-center text-[13px]" style={{ color: "#6B7280" }}>
        Carregando...
      </p>
    );
  }

  return (
    <div className="max-w-3xl">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ color: "#111111", letterSpacing: "-0.02em" }}
        >
          Configuração do timbre
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: "#6B7280" }}>
          Defina logo, cabeçalho e rodapé usados no texto gerado dos documentos.
        </p>
      </div>

      {error && (
        <div
          className="mt-4 rounded-lg border px-3 py-2 text-[13px]"
          style={{ borderColor: "#FCA5A5", backgroundColor: "#FEF2F2", color: "#B91C1C" }}
        >
          {error}
        </div>
      )}

      {/* Toggles */}
      <div
        className="mt-6 rounded-2xl border bg-white p-4"
        style={{ borderColor: "#EDEDED" }}
      >
        <h2
          className="text-[13px] font-semibold uppercase tracking-wider"
          style={{ color: "#6B7280", letterSpacing: "0.08em" }}
        >
          Modo de timbre
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          <ToggleRow
            label="Exibir timbre digital"
            description="Inclui cabeçalho e rodapé no texto copiado."
            checked={mostrarTimbre}
            onChange={handleToggleTimbre}
          />
          <ToggleRow
            label="Tenho papel timbrado físico"
            description="O texto é gerado limpo, sem cabeçalho/rodapé."
            checked={usarPapel}
            onChange={handleTogglePapel}
          />
        </div>
      </div>

      {/* Logo */}
      <div
        className="mt-6 rounded-2xl border bg-white p-4"
        style={{ borderColor: "#EDEDED" }}
      >
        <h2
          className="text-[13px] font-semibold uppercase tracking-wider"
          style={{ color: "#6B7280", letterSpacing: "0.08em" }}
        >
          Logo
        </h2>

        {logoUrl ? (
          <div className="mt-3 flex items-center gap-4">
            <div className="flex h-24 w-40 items-center justify-center rounded-lg border p-2" style={{ borderColor: "#EDEDED", backgroundColor: "#FAFAFA" }}>
              <img src={logoUrl} alt="Logo" className="max-h-20 max-w-full object-contain" />
            </div>
            <div className="flex gap-2">
              <label
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-[12px] font-medium"
                style={{ borderColor: "#EDEDED", color: "#111111" }}
              >
                <Upload className="h-3.5 w-3.5" />
                Trocar
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                onClick={handleRemoveLogo}
                className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-[12px] font-medium"
                style={{ borderColor: "#EDEDED", color: "#B91C1C" }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remover
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <label
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#4F46E5" }}
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Enviando..." : "Enviar logo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        )}
      </div>

      {/* Textos */}
      <div
        className="mt-6 rounded-2xl border bg-white p-4"
        style={{ borderColor: "#EDEDED" }}
      >
        <h2
          className="text-[13px] font-semibold uppercase tracking-wider"
          style={{ color: "#6B7280", letterSpacing: "0.08em" }}
        >
          Textos
        </h2>
        <div className="mt-3 flex flex-col gap-4">
          <div>
            <label className="text-[12px] font-medium" style={{ color: "#111111" }}>
              Texto do cabeçalho
            </label>
            <textarea
              value={cabecalho}
              onChange={(e) => setCabecalho(e.target.value)}
              rows={4}
              placeholder="Ex: Nome, CRO, endereço, telefone..."
              className="mt-1 w-full resize-y rounded-lg border px-3 py-2 text-[14px] outline-none focus:border-[#4F46E5]"
              style={{ borderColor: "#EDEDED", color: "#111111", backgroundColor: "#FAFAFA" }}
            />
          </div>
          <div>
            <label className="text-[12px] font-medium" style={{ color: "#111111" }}>
              Texto do rodapé
            </label>
            <textarea
              value={rodape}
              onChange={(e) => setRodape(e.target.value)}
              rows={4}
              placeholder="Ex: Assinatura, contatos, redes sociais..."
              className="mt-1 w-full resize-y rounded-lg border px-3 py-2 text-[14px] outline-none focus:border-[#4F46E5]"
              style={{ borderColor: "#EDEDED", color: "#111111", backgroundColor: "#FAFAFA" }}
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            {saved && (
              <span className="text-[12px] font-medium" style={{ color: "#10B981" }}>
                Salvo ✓
              </span>
            )}
            <button
              onClick={handleSaveTexts}
              disabled={upsertMut.isPending}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: "#4F46E5" }}
            >
              {upsertMut.isPending ? "Salvando..." : "Salvar textos"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium" style={{ color: "#111111" }}>
          {label}
        </div>
        <div className="text-[12.5px]" style={{ color: "#6B7280" }}>
          {description}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
        style={{ backgroundColor: checked ? "#4F46E5" : "#E5E7EB" }}
      >
        <span
          className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
          style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }}
        />
      </button>
    </label>
  );
}
