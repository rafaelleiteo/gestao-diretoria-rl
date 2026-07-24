import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Pencil, Trash2, X, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ALL_AREA_OPTIONS, TAB_AREAS, areaLabel, type AreaValue } from "@/lib/areas";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type TipoRecorrencia = "dia_mes" | "dia_semana" | "intervalo_meses";
export type DiaSemana = "seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom";

export type TarefaRecorrente = {
  id: string;
  area: AreaValue;
  titulo: string;
  tipo_recorrencia: TipoRecorrencia;
  dia_mes: number | null;
  dia_semana: DiaSemana | null;
  data_inicio: string | null; // date (YYYY-MM-DD)
  intervalo_meses: number | null;
  ultima_conclusao: string | null;
  criado_em: string;
};

const JS_DAY_TO_DIA: DiaSemana[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

const DIA_OPTIONS: { value: DiaSemana; label: string }[] = [
  { value: "seg", label: "Segunda-feira" },
  { value: "ter", label: "Terça-feira" },
  { value: "qua", label: "Quarta-feira" },
  { value: "qui", label: "Quinta-feira" },
  { value: "sex", label: "Sexta-feira" },
  { value: "sab", label: "Sábado" },
  { value: "dom", label: "Domingo" },
];

const DIA_SHORT: Record<DiaSemana, string> = {
  seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb", dom: "Dom",
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysInMonth(year: number, monthIdx: number): number {
  return new Date(year, monthIdx + 1, 0).getDate();
}

function clampDay(year: number, monthIdx: number, day: number): number {
  return Math.min(day, daysInMonth(year, monthIdx));
}

function parseDateOnly(s: string): Date {
  // YYYY-MM-DD → local midnight
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * Compute most recent occurrence (Date at 00:00 local) of a task's recurrence
 * pattern, on or before today. Returns null if it can't be computed
 * (e.g. intervalo_meses with data_inicio in the future).
 */
export function mostRecentOccurrenceForTarefa(t: TarefaRecorrente): Date | null {
  const today = startOfDay(new Date());

  if (t.tipo_recorrencia === "dia_mes" && t.dia_mes) {
    const y = today.getFullYear();
    const m = today.getMonth();
    const thisMonthDay = clampDay(y, m, t.dia_mes);
    if (today.getDate() >= thisMonthDay) {
      return new Date(y, m, thisMonthDay);
    }
    const prevY = m === 0 ? y - 1 : y;
    const prevM = m === 0 ? 11 : m - 1;
    return new Date(prevY, prevM, clampDay(prevY, prevM, t.dia_mes));
  }

  if (t.tipo_recorrencia === "dia_semana" && t.dia_semana) {
    const todayIdx = today.getDay();
    const target = JS_DAY_TO_DIA.indexOf(t.dia_semana);
    let diff = todayIdx - target;
    if (diff < 0) diff += 7;
    const d = new Date(today);
    d.setDate(d.getDate() - diff);
    return d;
  }

  if (t.tipo_recorrencia === "intervalo_meses" && t.data_inicio && t.intervalo_meses) {
    const start = startOfDay(parseDateOnly(t.data_inicio));
    if (start > today) return null;
    const startY = start.getFullYear();
    const startM = start.getMonth();
    const startDay = start.getDate();
    const monthsSince =
      (today.getFullYear() - startY) * 12 + (today.getMonth() - startM);
    let k = Math.floor(monthsSince / t.intervalo_meses);
    // Candidate: startM + k*intervalo_meses
    const build = (kk: number) => {
      const totalM = startM + kk * t.intervalo_meses!;
      const y = startY + Math.floor(totalM / 12);
      const m = ((totalM % 12) + 12) % 12;
      return new Date(y, m, clampDay(y, m, startDay));
    };
    let cand = build(k);
    if (cand > today && k > 0) cand = build(k - 1);
    return cand;
  }

  return null;
}

export function isTarefaPending(t: TarefaRecorrente): boolean {
  const occ = mostRecentOccurrenceForTarefa(t);
  if (!occ) return false;
  if (!t.ultima_conclusao) return true;
  return new Date(t.ultima_conclusao) < occ;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function describeRecorrencia(t: TarefaRecorrente): string {
  if (t.tipo_recorrencia === "dia_mes" && t.dia_mes) {
    return `Todo dia ${t.dia_mes} do mês`;
  }
  if (t.tipo_recorrencia === "dia_semana" && t.dia_semana) {
    return `Toda ${DIA_OPTIONS.find((o) => o.value === t.dia_semana)?.label ?? t.dia_semana}`;
  }
  if (t.tipo_recorrencia === "intervalo_meses" && t.data_inicio && t.intervalo_meses) {
    const start = parseDateOnly(t.data_inicio);
    return `A cada ${t.intervalo_meses} ${t.intervalo_meses === 1 ? "mês" : "meses"} — dia ${start.getDate()} (início ${formatDate(start)})`;
  }
  return "Recorrência incompleta";
}

// ============================================================
// Query hook
// ============================================================

export function useTarefasRecorrentes(areaFilter?: AreaValue) {
  return useQuery({
    queryKey: ["tarefas_recorrentes", areaFilter ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("tarefas_recorrentes" as never)
        .select("*")
        .order("criado_em", { ascending: false });
      if (areaFilter) q = q.eq("area", areaFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as TarefaRecorrente[]) ?? [];
    },
  });
}

function useToggleConclusao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tarefa, done }: { tarefa: TarefaRecorrente; done: boolean }) => {
      const patch = { ultima_conclusao: done ? new Date().toISOString() : null };
      const { error } = await supabase
        .from("tarefas_recorrentes" as never)
        .update(patch as never)
        .eq("id", tarefa.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tarefas_recorrentes"] }),
  });
}

function useDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tarefas_recorrentes" as never)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tarefas_recorrentes"] }),
  });
}

// ============================================================
// Form
// ============================================================

type FormProps = {
  editing?: TarefaRecorrente | null;
  defaultArea?: AreaValue;
  onDone: () => void;
};

function TarefaForm({ editing, defaultArea, onDone }: FormProps) {
  const qc = useQueryClient();
  const [area, setArea] = useState<AreaValue | "">(defaultArea ?? "");
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoRecorrencia>("dia_semana");
  const [diaMes, setDiaMes] = useState<string>("");
  const [diaSemana, setDiaSemana] = useState<DiaSemana | "">("");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [intervaloMeses, setIntervaloMeses] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setArea(editing.area);
      setTitulo(editing.titulo);
      setTipo(editing.tipo_recorrencia);
      setDiaMes(editing.dia_mes ? String(editing.dia_mes) : "");
      setDiaSemana((editing.dia_semana ?? "") as DiaSemana | "");
      setDataInicio(editing.data_inicio ?? "");
      setIntervaloMeses(editing.intervalo_meses ? String(editing.intervalo_meses) : "");
    } else {
      setArea(defaultArea ?? "");
      setTitulo("");
      setTipo("dia_semana");
      setDiaMes("");
      setDiaSemana("");
      setDataInicio("");
      setIntervaloMeses("");
    }
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id]);

  const save = useMutation({
    mutationFn: async () => {
      if (!titulo.trim()) throw new Error("Título é obrigatório.");
      if (!area) throw new Error("Selecione uma área.");
      const payload: Partial<TarefaRecorrente> & { titulo: string; area: AreaValue; tipo_recorrencia: TipoRecorrencia } = {
        titulo: titulo.trim(),
        area: area as AreaValue,
        tipo_recorrencia: tipo,
        dia_mes: null,
        dia_semana: null,
        data_inicio: null,
        intervalo_meses: null,
      };
      if (tipo === "dia_mes") {
        const n = Number(diaMes);
        if (!Number.isInteger(n) || n < 1 || n > 31) throw new Error("Dia do mês deve ser entre 1 e 31.");
        payload.dia_mes = n;
      } else if (tipo === "dia_semana") {
        if (!diaSemana) throw new Error("Selecione o dia da semana.");
        payload.dia_semana = diaSemana;
      } else {
        const n = Number(intervaloMeses);
        if (!Number.isInteger(n) || n < 1) throw new Error("Intervalo em meses deve ser ≥ 1.");
        if (!dataInicio) throw new Error("Informe a data de início.");
        payload.intervalo_meses = n;
        payload.data_inicio = dataInicio;
      }

      if (editing) {
        const { error } = await supabase
          .from("tarefas_recorrentes" as never)
          .update(payload as never)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tarefas_recorrentes" as never)
          .insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tarefas_recorrentes"] });
      onDone();
    },
    onError: (e: Error) => setError(e.message),
  });

  const intervaloPreview = useMemo(() => {
    if (tipo !== "intervalo_meses") return null;
    const n = Number(intervaloMeses);
    if (!dataInicio || !Number.isInteger(n) || n < 1) return null;
    const d = parseDateOnly(dataInicio);
    return `Vai repetir todo dia ${d.getDate()} a cada ${n} ${n === 1 ? "mês" : "meses"}.`;
  }, [tipo, intervaloMeses, dataInicio]);

  return (
    <div
      className="rounded-2xl border bg-white p-5"
      style={{ borderColor: editing ? "#4F46E5" : "#EDEDED" }}
    >
      {editing && (
        <div
          className="mb-3 flex items-center justify-between rounded-lg px-3 py-2 text-[12px] font-medium"
          style={{ backgroundColor: "#EEF0FF", color: "#4F46E5" }}
        >
          <span>Editando tarefa recorrente</span>
          <button type="button" onClick={onDone} className="inline-flex items-center gap-1">
            <X className="h-3.5 w-3.5" />
            Cancelar
          </button>
        </div>
      )}

      <input
        type="text"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Título da tarefa recorrente"
        className="w-full bg-transparent text-[15px] outline-none placeholder:text-[color:#B0B4BC]"
        style={{ color: "#111111" }}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="min-w-[200px]">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7280" }}>
            Área
          </div>
          <Select
            value={area || undefined}
            onValueChange={(v) => setArea(v as AreaValue)}
            disabled={!!defaultArea}
          >
            <SelectTrigger className="h-9 rounded-full border-[#EDEDED] bg-[#FAFAFA] text-[13px]">
              <SelectValue placeholder="Selecionar área" />
            </SelectTrigger>
            <SelectContent>
              {ALL_AREA_OPTIONS.filter((o) => o.value !== "geral").map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[220px]">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7280" }}>
            Tipo de recorrência
          </div>
          <Select value={tipo} onValueChange={(v) => setTipo(v as TipoRecorrencia)}>
            <SelectTrigger className="h-9 rounded-full border-[#EDEDED] bg-[#FAFAFA] text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dia_semana">Dia da semana</SelectItem>
              <SelectItem value="dia_mes">Dia fixo do mês</SelectItem>
              <SelectItem value="intervalo_meses">A cada X meses</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {tipo === "dia_mes" && (
        <div className="mt-4">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7280" }}>
            Dia do mês (1–31)
          </div>
          <input
            type="number"
            min={1}
            max={31}
            value={diaMes}
            onChange={(e) => setDiaMes(e.target.value)}
            className="h-9 w-28 rounded-full border bg-[#FAFAFA] px-3 text-[13px] outline-none focus:border-[#4F46E5]"
            style={{ borderColor: "#EDEDED", color: "#111111" }}
          />
          <p className="mt-1 text-[11px]" style={{ color: "#B0B4BC" }}>
            Se o mês não tiver esse dia, usa o último dia do mês.
          </p>
        </div>
      )}

      {tipo === "dia_semana" && (
        <div className="mt-4">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7280" }}>
            Dia da semana
          </div>
          <div className="min-w-[200px]">
            <Select value={diaSemana || undefined} onValueChange={(v) => setDiaSemana(v as DiaSemana)}>
              <SelectTrigger className="h-9 rounded-full border-[#EDEDED] bg-[#FAFAFA] text-[13px]">
                <SelectValue placeholder="Selecionar dia" />
              </SelectTrigger>
              <SelectContent>
                {DIA_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {tipo === "intervalo_meses" && (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7280" }}>
              Intervalo (meses)
            </div>
            <input
              type="number"
              min={1}
              value={intervaloMeses}
              onChange={(e) => setIntervaloMeses(e.target.value)}
              className="h-9 w-28 rounded-full border bg-[#FAFAFA] px-3 text-[13px] outline-none focus:border-[#4F46E5]"
              style={{ borderColor: "#EDEDED", color: "#111111" }}
            />
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6B7280" }}>
              Data de início
            </div>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="h-9 rounded-full border bg-[#FAFAFA] px-3 text-[13px] outline-none focus:border-[#4F46E5]"
              style={{ borderColor: "#EDEDED", color: "#111111" }}
            />
          </div>
          {intervaloPreview && (
            <p className="text-[12px]" style={{ color: "#6B7280" }}>{intervaloPreview}</p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 text-[12px]" style={{ color: "#B91C1C" }}>{error}</p>
      )}

      <div className="mt-4 flex items-center justify-end gap-2 border-t pt-3" style={{ borderColor: "#EDEDED" }}>
        <button
          type="button"
          onClick={onDone}
          className="rounded-full border px-4 py-2 text-[13px] font-medium"
          style={{ borderColor: "#EDEDED", color: "#6B7280" }}
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate()}
          className="rounded-full px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
          style={{ backgroundColor: "#4F46E5" }}
        >
          {save.isPending ? "Salvando..." : editing ? "Salvar" : "Criar"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Card
// ============================================================

export function TarefaCard({
  tarefa,
  onEdit,
  onDelete,
  compact,
}: {
  tarefa: TarefaRecorrente;
  onEdit?: (t: TarefaRecorrente) => void;
  onDelete?: (t: TarefaRecorrente) => void;
  compact?: boolean;
}) {
  const toggle = useToggleConclusao();
  const pending = isTarefaPending(tarefa);
  const occ = mostRecentOccurrenceForTarefa(tarefa);

  return (
    <li
      className="flex items-start gap-3 rounded-xl border bg-white px-4 py-3"
      style={{ borderColor: "#EDEDED", opacity: pending ? 1 : 0.55 }}
    >
      <div className="pt-0.5">
        <Checkbox
          checked={!pending}
          onCheckedChange={() => toggle.mutate({ tarefa, done: pending })}
          aria-label={pending ? "Marcar como concluída" : "Reabrir"}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="text-[14px] font-medium"
          style={{ color: "#111111", textDecoration: !pending ? "line-through" : "none" }}
        >
          {tarefa.titulo}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: "#6B7280" }}>
          {!compact && (
            <span
              className="rounded-full px-2 py-0.5 font-medium"
              style={{ backgroundColor: "#EEF0FF", color: "#4F46E5" }}
            >
              {areaLabel(tarefa.area)}
            </span>
          )}
          <span
            className="rounded-full px-2 py-0.5"
            style={{ backgroundColor: "#FAFAFA", color: "#6B7280" }}
          >
            {describeRecorrencia(tarefa)}
          </span>
          {occ && (
            <span title="Ocorrência mais recente">
              Última prevista: {formatDate(occ)}
            </span>
          )}
          {tarefa.ultima_conclusao && (
            <span title="Última conclusão">
              · Concluída: {formatDate(new Date(tarefa.ultima_conclusao))}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {!pending && (
          <button
            type="button"
            onClick={() => toggle.mutate({ tarefa, done: false })}
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]"
            style={{ borderColor: "#EDEDED", color: "#6B7280" }}
            title="Reabrir"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
        {pending && (
          <button
            type="button"
            onClick={() => toggle.mutate({ tarefa, done: true })}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-white"
            style={{ backgroundColor: "#4F46E5" }}
          >
            <Check className="h-3 w-3" />
            Concluir
          </button>
        )}
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(tarefa)}
            className="rounded-full border px-2 py-1 text-[11px]"
            style={{ borderColor: "#EDEDED", color: "#6B7280" }}
            title="Editar"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(tarefa)}
            className="rounded-full border px-2 py-1 text-[11px]"
            style={{ borderColor: "#EDEDED", color: "#B91C1C" }}
            title="Excluir"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    </li>
  );
}

// ============================================================
// Full-page module (grouped by area) or area-filtered section
// ============================================================

export function TarefasRecorrentesModule({
  areaFilter,
  compact,
}: {
  areaFilter?: AreaValue;
  compact?: boolean;
}) {
  const { data = [], isLoading } = useTarefasRecorrentes(areaFilter);
  const del = useDelete();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TarefaRecorrente | null>(null);

  const groups = useMemo(() => {
    if (areaFilter) return null;
    const map = new Map<AreaValue, TarefaRecorrente[]>();
    for (const t of data) {
      const arr = map.get(t.area) ?? [];
      arr.push(t);
      map.set(t.area, arr);
    }
    return TAB_AREAS
      .map((a) => ({ area: a.slug as AreaValue, label: a.label, items: map.get(a.slug as AreaValue) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [data, areaFilter]);

  const handleEdit = (t: TarefaRecorrente) => {
    setEditing(t);
    setShowForm(true);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = (t: TarefaRecorrente) => {
    if (typeof window !== "undefined" && !window.confirm(`Excluir "${t.titulo}"?`)) return;
    del.mutate(t.id);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: "#6B7280" }}>
            Tarefas Recorrentes{areaFilter ? ` · ${areaLabel(areaFilter)}` : ""}
          </h2>
          <p className="mt-0.5 text-[12px]" style={{ color: "#B0B4BC" }}>
            Hábitos e tarefas que se repetem. Marque como concluída — volta sozinha na próxima ocorrência.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-white"
            style={{ backgroundColor: "#4F46E5" }}
          >
            <Plus className="h-3.5 w-3.5" />
            Nova tarefa recorrente
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-4">
          <TarefaForm
            editing={editing}
            defaultArea={areaFilter}
            onDone={() => { setShowForm(false); setEditing(null); }}
          />
        </div>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-[13px]" style={{ color: "#B0B4BC" }}>Carregando...</div>
      ) : data.length === 0 ? (
        <div
          className="rounded-2xl border py-10 text-center text-[13px]"
          style={{ borderColor: "#EDEDED", color: "#B0B4BC" }}
        >
          Nenhuma tarefa recorrente{areaFilter ? " nesta área" : ""} ainda.
        </div>
      ) : areaFilter ? (
        <ul className="flex flex-col gap-2">
          {data.map((t) => (
            <TarefaCard key={t.id} tarefa={t} onEdit={handleEdit} onDelete={handleDelete} compact={compact} />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col gap-6">
          {groups!.map((g) => (
            <section key={g.area}>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-[13px] font-semibold" style={{ color: "#111111" }}>{g.label}</h3>
                <span className="text-[11px]" style={{ color: "#B0B4BC" }}>{g.items.length}</span>
              </div>
              <ul className="flex flex-col gap-2">
                {g.items.map((t) => (
                  <TarefaCard key={t.id} tarefa={t} onEdit={handleEdit} onDelete={handleDelete} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Compact "today" list (used in Home)
// ============================================================

export function useTarefasDueToday() {
  const { data = [], isLoading } = useTarefasRecorrentes();
  const items = useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    return data.filter((t) => {
      const occ = mostRecentOccurrenceForTarefa(t);
      if (!occ) return false;
      if (occ.getTime() !== today) return false;
      return isTarefaPending(t);
    });
  }, [data]);
  return { items, isLoading };
}

export { DIA_SHORT };
