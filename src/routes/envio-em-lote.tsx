import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TAB_AREAS, ALL_AREA_OPTIONS, type AreaValue } from "@/lib/areas";
import { PRIORIDADE_FILTER_OPTIONS, type Prioridade, type Tipo } from "@/components/Inbox";
import { HomeFilterSidebarLayout } from "@/components/HomeFilterSidebar";
import { ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/envio-em-lote")({
  component: EnvioEmLote,
});

type ProcessResult = {
  createdCount: number;
  fallbacks: {
    line: number;
    text: string;
    appliedFallbacks: string[];
  }[];
  errors: {
    line: number;
    text: string;
    error: string;
  }[];
};

function EnvioEmLote() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [result, setResult] = useState<ProcessResult | null>(null);

  const processMutation = useMutation({
    mutationFn: async (lines: string[]) => {
      const results: ProcessResult = {
        createdCount: 0,
        fallbacks: [],
        errors: [],
      };

      const validPriorities = PRIORIDADE_FILTER_OPTIONS.map((p) => p.value);
      const validTypes = ["mensagem", "ideia", "tarefa"];
      const areaOptions = ALL_AREA_OPTIONS;

      const itemsToInsert: any[] = [];

      lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const trimmedLine = line.trim();
        if (!trimmedLine) return;

        const parts = trimmedLine.split(";").map((p) => p.trim());
        const texto = parts[0];

        if (!texto) {
          results.errors.push({
            line: lineNumber,
            text: trimmedLine,
            error: "Texto obrigatório ausente",
          });
          return;
        }

        const appliedFallbacks: string[] = [];
        
        // Área
        let area: AreaValue = "geral";
        if (parts[1]) {
          const matchedArea = areaOptions.find(
            (a) => a.label.toLowerCase() === parts[1].toLowerCase()
          );
          if (matchedArea) {
            area = matchedArea.value;
          } else {
            appliedFallbacks.push(`Área: "${parts[1]}" não encontrada (usando Área Geral)`);
          }
        } else {
          // No area provided, default to 'geral'
        }

        // Tipo
        let tipo: Tipo = "tarefa";
        if (parts[2]) {
          const typeInput = parts[2].toLowerCase();
          const matchedType = validTypes.find((t) => t === typeInput);
          if (matchedType) {
            tipo = matchedType as Tipo;
          } else {
            appliedFallbacks.push(`Tipo: "${parts[2]}" não encontrado (usando Tarefa)`);
          }
        } else {
          // Explicitly fallback to "tarefa" if empty, as per rules
          tipo = "tarefa";
        }

        // Prioridade
        let prioridades: Prioridade[] = ["indiferente"];
        if (parts[3]) {
          const rawPriorities = parts[3].split(",").map((p) => p.trim().toLowerCase());
          const filtered = rawPriorities.filter((p) => validPriorities.includes(p as Prioridade)) as Prioridade[];
          
          if (filtered.length > 0) {
            prioridades = filtered;
            if (filtered.length < rawPriorities.length) {
              appliedFallbacks.push(`Prioridade: alguns valores inválidos descartados`);
            }
          } else {
            appliedFallbacks.push(`Prioridade: "${parts[3]}" inválida (usando Indiferente)`);
          }
        }

        itemsToInsert.push({
          texto,
          area,
          tipo,
          prioridades,
          concluido: false,
          aguardando_feedback: false,
        });

        if (appliedFallbacks.length > 0) {
          results.fallbacks.push({
            line: lineNumber,
            text: texto,
            appliedFallbacks,
          });
        }
      });

      if (itemsToInsert.length > 0) {
        const { error } = await supabase.from("inbox_items").insert(itemsToInsert);
        if (error) throw error;
        results.createdCount = itemsToInsert.length;
      }

      return results;
    },
    onError: (err: any) => {
      toast.error(`Erro ao processar lote: ${err.message || "Erro desconhecido"}`);
    },
    onSuccess: (res) => {
      setResult(res);
      setText("");
      qc.invalidateQueries({ queryKey: ["inbox_items"] });
    },
  });

  const handleProcess = () => {
    if (processMutation.isPending) return;
    const lines = text.split("\n");
    processMutation.mutate(lines);
  };

  const sidebarItems = [
    {
      key: "voltar",
      label: "Voltar para Início",
      icon: ArrowLeft,
      active: false,
      onSelect: () => navigate({ to: "/" }),
    },
  ];

  return (
    <HomeFilterSidebarLayout title="Ações" items={sidebarItems}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <h1
            className="text-3xl font-bold"
            style={{ color: "#111111", letterSpacing: "-0.02em" }}
          >
            Envio em lote
          </h1>
          <p className="mt-1 text-[14px]" style={{ color: "#6B7280" }}>
            Adicione múltiplos itens à sua Caixa de Entrada de uma só vez.
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-6" style={{ borderColor: "#EDEDED" }}>
          <div className="mb-4">
            <h2 className="text-[14px] font-semibold" style={{ color: "#111111" }}>
              Formato esperado
            </h2>
            <p className="mt-1 text-[13px]" style={{ color: "#6B7280" }}>
              Uma linha por item, campos separados por ponto e vírgula:
              <br />
              <code className="mt-1 inline-block rounded bg-[#FAFAFA] px-2 py-1 font-mono text-[12px]">
                texto;área;tipo;prioridade
              </code>
            </p>
            <div className="mt-3 rounded-lg border bg-[#FAFAFA] p-3 text-[12px] font-mono" style={{ borderColor: "#EDEDED" }}>
              Ligar pro fornecedor de brackets;Consultório;tarefa;urgente
              <br />
              Revisar boleto do aluguel;Financeiro;;importante,hoje
              <br />
              Ideia de curso novo;Especialização;ideia;
            </div>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Cole aqui o bloco de texto..."
            className="h-64 w-full resize-none rounded-xl border p-4 text-[14px] outline-none transition-all focus:border-[#4F46E5]"
            style={{ borderColor: "#EDEDED", color: "#111111" }}
          />

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleProcess}
              disabled={processMutation.isPending}
              className="rounded-full px-6 py-2.5 text-[14px] font-semibold text-white transition-opacity disabled:opacity-40"
              style={{ backgroundColor: "#4F46E5" }}
            >
              {processMutation.isPending ? "Processando..." : "Processar em lote"}
            </button>
          </div>
        </div>

        {result && (
          <div className="mt-8 flex flex-col gap-4">
            <div className="flex items-center gap-2 rounded-xl border bg-white p-4" style={{ borderColor: "#EDEDED" }}>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-[15px] font-medium" style={{ color: "#111111" }}>
                {result.createdCount} itens criados com sucesso.
              </span>
            </div>

            {(result.fallbacks.length > 0 || result.errors.length > 0) && (
              <div className="rounded-xl border bg-white p-5" style={{ borderColor: "#EDEDED" }}>
                <h3 className="mb-3 text-[14px] font-semibold" style={{ color: "#111111" }}>
                  Relatório de processamento
                </h3>
                
                <div className="flex flex-col gap-4">
                  {result.errors.map((err, idx) => (
                    <div key={`err-${idx}`} className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-[13px]">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                      <div>
                        <span className="font-semibold text-red-700">Linha {err.line}:</span>{" "}
                        <span className="text-red-600">"{err.text}"</span> — {err.error}
                      </div>
                    </div>
                  ))}

                  {result.fallbacks.map((fb, idx) => (
                    <div key={`fb-${idx}`} className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-[13px]">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <div>
                        <span className="font-semibold text-amber-700">Linha {fb.line}:</span>{" "}
                        <span className="text-amber-800">"{fb.text}"</span>
                        <ul className="mt-1 list-inside list-disc text-amber-600">
                          {fb.appliedFallbacks.map((msg, midx) => (
                            <li key={midx}>{msg}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </HomeFilterSidebarLayout>
  );
}
