import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";

export const Route = createFileRoute("/consultorio/ficha-planejamento")({
  head: () => ({
    meta: [
      { title: "Ficha de Planejamento — Consultório" },
      { name: "description", content: "Ficha de planejamento ortodôntico." },
      { property: "og:title", content: "Ficha de Planejamento — Consultório" },
      { property: "og:description", content: "Ficha de planejamento ortodôntico." },
    ],
  }),
  component: FichaPlanejamento,
});

// ---------- tipos ----------

type ChoiceWithOther = {
  option: string;
  other: string;
  obs: string;
};

const empty = (): ChoiceWithOther => ({ option: "", other: "", obs: "" });

type State = {
  paciente: string;
  dentista: string;
  condicaoClinica: string;
  manchaBranca: ChoiceWithOther;
  reabsorcaoRadicular: ChoiceWithOther;
  seioMaxilar: { option: string; other: string };
  condicaoPeriodontal: string;
  nivelOsseo: string;
  biotipo: string;
  recessao: string;
  exposicaoIncisivo: string;
  relacaoMolares: { option: string; mm: string };
  terceirosMolares: { option: string; dente: string };
  segundosMolares: string;
  planoTratamento: string;
  instalacaoImplantes: string;
  miniImplantes: string;
  prescricao: string;
  desenvolvimentoClinico: string;
  prazo: string;
  checklist: string[];
};

const INITIAL: State = {
  paciente: "",
  dentista: "",
  condicaoClinica: "",
  manchaBranca: empty(),
  reabsorcaoRadicular: empty(),
  seioMaxilar: { option: "", other: "" },
  condicaoPeriodontal: "",
  nivelOsseo: "",
  biotipo: "",
  recessao: "",
  exposicaoIncisivo: "",
  relacaoMolares: { option: "", mm: "" },
  terceirosMolares: { option: "", dente: "" },
  segundosMolares: "",
  planoTratamento: "",
  instalacaoImplantes: "",
  miniImplantes: "",
  prescricao: "",
  desenvolvimentoClinico: "",
  prazo: "",
  checklist: [],
};

// ---------- opções ----------

const OPTS_MANCHA = ["Presente pontual", "Presente generalizada", "Ausente", "Outro"];
const OPTS_REABS = ["Presente pontual", "Presente generalizada", "Ausente", "Outro"];
const OPTS_SEIO = ["Alto", "Baixo", "Extremamente baixo", "Outro"];
const OPTS_PERIO = [
  "Saudável",
  "Ruim",
  "Ruim, mas atualmente saudável",
  "Doença periodontal ativa",
  "Perda óssea generalizada",
];
const OPTS_EXPOSICAO = ["Aumentada", "Diminuída", "Normal"];
const OPTS_MOLARES = ["Simétrico", "Assimétrico"];
const OPTS_TERCEIROS = ["Indicação de exodontia", "Sem indicação de exodontia"];
const OPTS_SEGUNDOS = ["Incluir na mecânica", "Não incluir na mecânica", "Indiferente"];
const OPTS_CHECKLIST = ["OK", "Termo enviado", "Necessita NFe"];

// ---------- helpers para o texto ----------

function formatChoiceWithOther(c: ChoiceWithOther): string {
  if (!c.option) return "";
  const isOutro = c.option === "Outro";
  const base = isOutro ? c.other.trim() : c.option;
  if (!base) return "";
  const showObs = c.option === "Presente pontual" || c.option === "Presente generalizada" || isOutro;
  if (showObs && c.obs.trim()) return `${base} (${c.obs.trim()})`;
  return base;
}

function formatSeio(v: { option: string; other: string }): string {
  if (!v.option) return "";
  if (v.option === "Outro") return v.other.trim();
  return v.option;
}

function formatMolares(v: { option: string; mm: string }): string {
  if (!v.option) return "";
  if (v.option === "Assimétrico" && v.mm.trim()) return `Assimétrico (${v.mm.trim()})`;
  return v.option;
}

function formatTerceiros(v: { option: string; dente: string }): string {
  if (!v.option) return "";
  if (v.option === "Indicação de exodontia" && v.dente.trim())
    return `Indicação de exodontia (${v.dente.trim()})`;
  return v.option;
}

function buildText(s: State): string {
  const lines: string[] = [];
  const push = (label: string, value: string) => {
    if (value && value.trim()) lines.push(`${label}: ${value.trim()}`);
  };

  push("Nome do paciente", s.paciente);
  push("Dentista clínico", s.dentista);
  push("Condição clínica", s.condicaoClinica);
  push("Mancha branca", formatChoiceWithOther(s.manchaBranca));
  push("Reabsorção radicular", formatChoiceWithOther(s.reabsorcaoRadicular));
  push("Seio maxilar", formatSeio(s.seioMaxilar));
  push("Condição Periodontal", s.condicaoPeriodontal);
  push("Nível ósseo individual", s.nivelOsseo);
  push("Biotipo periodontal", s.biotipo);
  push("Recessão gengival", s.recessao);
  push("Exposição Incisivo Superior", s.exposicaoIncisivo);
  push("Relação Molares D e E", formatMolares(s.relacaoMolares));
  push("3º molares", formatTerceiros(s.terceirosMolares));
  push("2º molares", s.segundosMolares);
  push("Plano de tratamento", s.planoTratamento);
  push("Instalação de implantes", s.instalacaoImplantes);
  push("Mini-implantes", s.miniImplantes);
  push("Prescrição/Individualização", s.prescricao);
  push("Desenvolvimento Clínico", s.desenvolvimentoClinico);
  push("Prazo de tratamento", s.prazo);
  if (s.checklist.length > 0) lines.push(`Checklist: ${s.checklist.join(", ")}`);
  return lines.join("\n");
}

// ---------- primitives ----------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="mb-3 text-[11px] font-semibold uppercase tracking-wider"
      style={{ color: "#4F46E5", letterSpacing: "0.08em" }}
    >
      {children}
    </h3>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium" style={{ color: "#111111" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  borderColor: "#EDEDED",
  backgroundColor: "#FFFFFF",
  color: "#111111",
};

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none focus:border-[#4F46E5]"
      style={inputStyle}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      rows={props.rows ?? 3}
      className="w-full resize-y rounded-lg border px-3 py-2 text-[13px] outline-none focus:border-[#4F46E5]"
      style={inputStyle}
    />
  );
}

function Chips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(active ? "" : opt)}
            className="rounded-full border px-3 py-1 text-[12px] font-medium transition-colors"
            style={
              active
                ? { backgroundColor: "#4F46E5", color: "#FFFFFF", borderColor: "#4F46E5" }
                : { backgroundColor: "#FFFFFF", color: "#6B7280", borderColor: "#EDEDED" }
            }
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function MultiChips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() =>
              onChange(active ? value.filter((v) => v !== opt) : [...value, opt])
            }
            className="rounded-full border px-3 py-1 text-[12px] font-medium transition-colors"
            style={
              active
                ? { backgroundColor: "#4F46E5", color: "#FFFFFF", borderColor: "#4F46E5" }
                : { backgroundColor: "#FFFFFF", color: "#6B7280", borderColor: "#EDEDED" }
            }
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ---------- página ----------

function FichaPlanejamento() {
  const [s, setS] = useState<State>(INITIAL);
  const [copied, setCopied] = useState(false);

  const text = useMemo(() => buildText(s), [s]);

  const set = <K extends keyof State>(k: K, v: State[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  const copy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const showManchaObs =
    s.manchaBranca.option === "Presente pontual" ||
    s.manchaBranca.option === "Presente generalizada" ||
    s.manchaBranca.option === "Outro";
  const showReabsObs =
    s.reabsorcaoRadicular.option === "Presente pontual" ||
    s.reabsorcaoRadicular.option === "Presente generalizada" ||
    s.reabsorcaoRadicular.option === "Outro";

  return (
    <div>
      <div className="mb-8">
        <h1
          className="text-3xl font-bold"
          style={{ color: "#111111", letterSpacing: "-0.02em" }}
        >
          Ficha de Planejamento
        </h1>
        <p className="mt-2 text-[13px]" style={{ color: "#6B7280" }}>
          Preencha os campos à esquerda — o texto é gerado em tempo real para copiar no Clinicorp.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_420px]">
        {/* formulário */}
        <div className="flex flex-col gap-8">
          <section>
            <SectionTitle>Identificação</SectionTitle>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nome do paciente">
                <TextInput
                  value={s.paciente}
                  onChange={(e) => set("paciente", e.target.value)}
                />
              </Field>
              <Field label="Dentista clínico">
                <TextInput
                  value={s.dentista}
                  onChange={(e) => set("dentista", e.target.value)}
                />
              </Field>
            </div>
          </section>

          <section>
            <SectionTitle>Condição clínica</SectionTitle>
            <div className="flex flex-col gap-4">
              <Field label="Condição clínica">
                <TextArea
                  value={s.condicaoClinica}
                  onChange={(e) => set("condicaoClinica", e.target.value)}
                />
              </Field>

              <Field label="Mancha branca">
                <Chips
                  options={OPTS_MANCHA}
                  value={s.manchaBranca.option}
                  onChange={(v) =>
                    set("manchaBranca", { ...s.manchaBranca, option: v })
                  }
                />
                {s.manchaBranca.option === "Outro" && (
                  <TextInput
                    placeholder="Especificar"
                    value={s.manchaBranca.other}
                    onChange={(e) =>
                      set("manchaBranca", { ...s.manchaBranca, other: e.target.value })
                    }
                  />
                )}
                {showManchaObs && (
                  <TextInput
                    placeholder="Onde / observação (opcional)"
                    value={s.manchaBranca.obs}
                    onChange={(e) =>
                      set("manchaBranca", { ...s.manchaBranca, obs: e.target.value })
                    }
                  />
                )}
              </Field>

              <Field label="Reabsorção radicular">
                <Chips
                  options={OPTS_REABS}
                  value={s.reabsorcaoRadicular.option}
                  onChange={(v) =>
                    set("reabsorcaoRadicular", { ...s.reabsorcaoRadicular, option: v })
                  }
                />
                {s.reabsorcaoRadicular.option === "Outro" && (
                  <TextInput
                    placeholder="Especificar"
                    value={s.reabsorcaoRadicular.other}
                    onChange={(e) =>
                      set("reabsorcaoRadicular", {
                        ...s.reabsorcaoRadicular,
                        other: e.target.value,
                      })
                    }
                  />
                )}
                {showReabsObs && (
                  <TextInput
                    placeholder="Onde / observação (opcional)"
                    value={s.reabsorcaoRadicular.obs}
                    onChange={(e) =>
                      set("reabsorcaoRadicular", {
                        ...s.reabsorcaoRadicular,
                        obs: e.target.value,
                      })
                    }
                  />
                )}
              </Field>

              <Field label="Seio maxilar">
                <Chips
                  options={OPTS_SEIO}
                  value={s.seioMaxilar.option}
                  onChange={(v) => set("seioMaxilar", { ...s.seioMaxilar, option: v })}
                />
                {s.seioMaxilar.option === "Outro" && (
                  <TextInput
                    placeholder="Especificar"
                    value={s.seioMaxilar.other}
                    onChange={(e) =>
                      set("seioMaxilar", { ...s.seioMaxilar, other: e.target.value })
                    }
                  />
                )}
              </Field>
            </div>
          </section>

          <section>
            <SectionTitle>Condição periodontal</SectionTitle>
            <div className="flex flex-col gap-4">
              <Field label="Condição Periodontal">
                <Chips
                  options={OPTS_PERIO}
                  value={s.condicaoPeriodontal}
                  onChange={(v) => set("condicaoPeriodontal", v)}
                />
              </Field>
              <Field label="Nível ósseo individual">
                <TextInput
                  value={s.nivelOsseo}
                  onChange={(e) => set("nivelOsseo", e.target.value)}
                />
              </Field>
              <Field label="Biotipo periodontal">
                <TextInput
                  value={s.biotipo}
                  onChange={(e) => set("biotipo", e.target.value)}
                />
              </Field>
              <Field label="Recessão gengival">
                <TextInput
                  value={s.recessao}
                  onChange={(e) => set("recessao", e.target.value)}
                />
              </Field>
            </div>
          </section>

          <section>
            <SectionTitle>Relações dentárias</SectionTitle>
            <div className="flex flex-col gap-4">
              <Field label="Exposição Incisivo Superior">
                <Chips
                  options={OPTS_EXPOSICAO}
                  value={s.exposicaoIncisivo}
                  onChange={(v) => set("exposicaoIncisivo", v)}
                />
              </Field>

              <Field label="Relação Molares D e E">
                <Chips
                  options={OPTS_MOLARES}
                  value={s.relacaoMolares.option}
                  onChange={(v) =>
                    set("relacaoMolares", { ...s.relacaoMolares, option: v })
                  }
                />
                {s.relacaoMolares.option === "Assimétrico" && (
                  <TextInput
                    placeholder="Especificar em mm"
                    value={s.relacaoMolares.mm}
                    onChange={(e) =>
                      set("relacaoMolares", {
                        ...s.relacaoMolares,
                        mm: e.target.value,
                      })
                    }
                  />
                )}
              </Field>

              <Field label="3º molares">
                <Chips
                  options={OPTS_TERCEIROS}
                  value={s.terceirosMolares.option}
                  onChange={(v) =>
                    set("terceirosMolares", { ...s.terceirosMolares, option: v })
                  }
                />
                {s.terceirosMolares.option === "Indicação de exodontia" && (
                  <TextInput
                    placeholder="Qual dente indicado"
                    value={s.terceirosMolares.dente}
                    onChange={(e) =>
                      set("terceirosMolares", {
                        ...s.terceirosMolares,
                        dente: e.target.value,
                      })
                    }
                  />
                )}
              </Field>

              <Field label="2º molares">
                <Chips
                  options={OPTS_SEGUNDOS}
                  value={s.segundosMolares}
                  onChange={(v) => set("segundosMolares", v)}
                />
              </Field>
            </div>
          </section>

          <section>
            <SectionTitle>Plano de tratamento</SectionTitle>
            <div className="flex flex-col gap-4">
              <Field label="Plano de tratamento">
                <TextArea
                  value={s.planoTratamento}
                  onChange={(e) => set("planoTratamento", e.target.value)}
                />
              </Field>
              <Field label="Instalação de implantes">
                <TextInput
                  value={s.instalacaoImplantes}
                  onChange={(e) => set("instalacaoImplantes", e.target.value)}
                />
              </Field>
              <Field label="Mini-implantes">
                <TextInput
                  value={s.miniImplantes}
                  onChange={(e) => set("miniImplantes", e.target.value)}
                />
              </Field>
              <Field label="Prescrição/Individualização">
                <TextArea
                  value={s.prescricao}
                  onChange={(e) => set("prescricao", e.target.value)}
                />
              </Field>
              <Field label="Desenvolvimento Clínico">
                <TextArea
                  value={s.desenvolvimentoClinico}
                  onChange={(e) => set("desenvolvimentoClinico", e.target.value)}
                />
              </Field>
              <Field label="Prazo de tratamento">
                <TextInput
                  placeholder="ex: 18 meses"
                  value={s.prazo}
                  onChange={(e) => set("prazo", e.target.value)}
                />
              </Field>
            </div>
          </section>

          <section>
            <SectionTitle>Checklist final</SectionTitle>
            <MultiChips
              options={OPTS_CHECKLIST}
              value={s.checklist}
              onChange={(v) => set("checklist", v)}
            />
          </section>
        </div>

        {/* preview */}
        <div className="lg:sticky lg:top-[89px] lg:h-fit">
          <SectionTitle>Texto gerado</SectionTitle>
          <div
            className="rounded-2xl border p-4"
            style={{ borderColor: "#EDEDED", backgroundColor: "#FAFAFA" }}
          >
            {text ? (
              <pre
                className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed"
                style={{ color: "#111111" }}
              >
                {text}
              </pre>
            ) : (
              <p className="text-[13px]" style={{ color: "#6B7280" }}>
                Preencha os campos ao lado para gerar o texto.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={copy}
            disabled={!text}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-medium text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: "#4F46E5" }}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" /> Copiado ✓
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" /> Copiar texto
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
