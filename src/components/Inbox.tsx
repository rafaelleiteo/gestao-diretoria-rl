import {
  useState,
  useMemo,
  useEffect,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Bell, BellRing, X } from "lucide-react";
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

type InboxEditCtx = {
  editing: InboxItem | null;
  startEdit: (item: InboxItem) => void;
  clear: () => void;
};
const InboxEditContext = createContext<InboxEditCtx | null>(null);

export function InboxEditProvider({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState<InboxItem | null>(null);
  return (
    <InboxEditContext.Provider
      value={{
        editing,
        startEdit: (item) => {
          setEditing(item);
          if (typeof window !== "undefined") {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        },
        clear: () => setEditing(null),
      }}
    >
      {children}
    </InboxEditContext.Provider>
  );
}

function useInboxEdit(): InboxEditCtx | null {
  return useContext(InboxEditContext);
}


type Tipo = "mensagem" | "ideia" | "tarefa";

export type Prioridade =
  | "urgente"
  | "importante"
  | "hoje"
  | "longo_prazo"
  | "indiferente";

export type DiaSemana = "seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom";

export type InboxItem = {
  id: string;
  texto: string;
  tipo: Tipo;
  area: AreaValue;
  concluido: boolean;
  criado_em: string;
  lembrete_data_hora: string | null;
  lembrete_enviado: boolean;
  prioridades: Prioridade[];
  dia_semana: DiaSemana | null;
  concluido_em: string | null;
};

const TIPO_OPTIONS: { value: Tipo; label: string }[] = [
  { value: "mensagem", label: "Mensagem" },
  { value: "ideia", label: "Ideia" },
  { value: "tarefa", label: "Tarefa" },
];

const PRIORIDADE_OPTIONS: { value: Prioridade; label: string }[] = [
  { value: "urgente", label: "Urgente" },
  { value: "importante", label: "Importante" },
  { value: "hoje", label: "Hoje" },
  { value: "longo_prazo", label: "Longo prazo" },
  { value: "indiferente", label: "Indiferente" },
];

const DIA_OPTIONS: { value: DiaSemana; label: string }[] = [
  { value: "seg", label: "Seg" },
  { value: "ter", label: "Ter" },
  { value: "qua", label: "Qua" },
  { value: "qui", label: "Qui" },
  { value: "sex", label: "Sex" },
  { value: "sab", label: "Sáb" },
  { value: "dom", label: "Dom" },
];

// Map JS Date.getDay() (0=dom..6=sab) to our DiaSemana values.
const JS_DAY_TO_DIA: DiaSemana[] = [
  "dom",
  "seg",
  "ter",
  "qua",
  "qui",
  "sex",
  "sab",
];

function todayDia(): DiaSemana {
  return JS_DAY_TO_DIA[new Date().getDay()];
}

// Most recent occurrence (as a Date at 00:00 local) of the given weekday.
// If today matches, returns today at 00:00.
function mostRecentOccurrence(dia: DiaSemana): Date {
  const now = new Date();
  const todayIdx = now.getDay();
  const target = JS_DAY_TO_DIA.indexOf(dia);
  let diff = todayIdx - target;
  if (diff < 0) diff += 7;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - diff);
  return d;
}

// A recurring item (dia_semana set) is pending in the current occurrence
// unless it was completed at/after the most recent occurrence.
export function isItemPending(item: InboxItem): boolean {
  if (item.dia_semana) {
    if (!item.concluido || !item.concluido_em) return true;
    const occ = mostRecentOccurrence(item.dia_semana);
    return new Date(item.concluido_em) < occ;
  }
  return !item.concluido;
}

function tipoDot(tipo: Tipo): string {
  if (tipo === "tarefa") return "#4F46E5";
  if (tipo === "ideia") return "#B0B4BC";
  return "#6B7280";
}

function formatLembrete(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function prioridadeStyle(p: Prioridade): { bg: string; color: string } {
  if (p === "urgente") return { bg: "#FEE2E2", color: "#B91C1C" };
  if (p === "importante") return { bg: "#FEF3C7", color: "#B45309" };
  if (p === "hoje") return { bg: "#EEF0FF", color: "#4F46E5" };
  if (p === "longo_prazo") return { bg: "#E0E7FF", color: "#3730A3" };
  return { bg: "#FAFAFA", color: "#6B7280" };
}

function prioridadeLabel(p: Prioridade): string {
  return PRIORIDADE_OPTIONS.find((o) => o.value === p)?.label ?? p;
}

function diaLabel(d: DiaSemana): string {
  return DIA_OPTIONS.find((o) => o.value === d)?.label ?? d;
}

export function InboxForm({ defaultArea }: { defaultArea?: AreaValue }) {
  const qc = useQueryClient();
  const editCtx = useInboxEdit();
  const editing = editCtx?.editing ?? null;
  const isEditing = editing !== null;

  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<Tipo | "">("");
  const [area, setArea] = useState<AreaValue | "">(defaultArea ?? "");
  const [prioridades, setPrioridades] = useState<Prioridade[]>([]);
  const [diaSemana, setDiaSemana] = useState<DiaSemana | "nenhum">("nenhum");
  const [lembreteOn, setLembreteOn] = useState(false);
  const [lembreteLocal, setLembreteLocal] = useState<string>("");
  const [prioridadeError, setPrioridadeError] = useState(false);

  // Sync form with the item being edited (or reset when leaving edit mode).
  useEffect(() => {
    if (editing) {
      setTexto(editing.texto);
      setTipo(editing.tipo);
      setArea(editing.area);
      setPrioridades(editing.prioridades ?? []);
      setDiaSemana(editing.dia_semana ?? "nenhum");
      if (editing.lembrete_data_hora) {
        setLembreteOn(true);
        setLembreteLocal(toLocalInputValue(new Date(editing.lembrete_data_hora)));
      } else {
        setLembreteOn(false);
        setLembreteLocal("");
      }
      setPrioridadeError(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id]);

  const resetForm = () => {
    setTexto("");
    setTipo("");
    if (!defaultArea) setArea("");
    setPrioridades([]);
    setDiaSemana("nenhum");
    setLembreteOn(false);
    setLembreteLocal("");
    setPrioridadeError(false);
  };

  const togglePrioridade = (p: Prioridade) => {
    setPrioridades((prev) => {
      const next = prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p];
      if (next.length > 0) setPrioridadeError(false);
      return next;
    });
  };

  const canSubmit =
    texto.trim().length > 0 &&
    tipo !== "" &&
    area !== "" &&
    prioridades.length > 0 &&
    (!lembreteOn || lembreteLocal.length > 0);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const lembreteIso =
        lembreteOn && lembreteLocal
          ? new Date(lembreteLocal).toISOString()
          : null;

      if (isEditing && editing) {
        const patch: {
          texto: string;
          tipo: Tipo;
          area: AreaValue;
          prioridades: Prioridade[];
          dia_semana: DiaSemana | null;
          lembrete_data_hora: string | null;
          lembrete_enviado?: boolean;
        } = {
          texto: texto.trim(),
          tipo: tipo as Tipo,
          area: area as AreaValue,
          prioridades,
          dia_semana: diaSemana === "nenhum" ? null : diaSemana,
          lembrete_data_hora: lembreteIso,
        };
        // If the reminder date/time changed on an already-sent item,
        // reset lembrete_enviado so it fires again.
        if (
          editing.lembrete_enviado &&
          lembreteIso !== editing.lembrete_data_hora
        ) {
          patch.lembrete_enviado = false;
        }
        const { error } = await supabase
          .from("inbox_items")
          .update(patch as never)
          .eq("id", editing.id);
        if (error) throw error;
        return;
      }

      const payload: {
        texto: string;
        tipo: Tipo;
        area: AreaValue;
        prioridades: Prioridade[];
        dia_semana?: DiaSemana | null;
        lembrete_data_hora?: string | null;
      } = {
        texto: texto.trim(),
        tipo: tipo as Tipo,
        area: area as AreaValue,
        prioridades,
        dia_semana: diaSemana === "nenhum" ? null : diaSemana,
      };
      if (lembreteIso) payload.lembrete_data_hora = lembreteIso;
      const { error } = await supabase.from("inbox_items").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      resetForm();
      editCtx?.clear();
      qc.invalidateQueries({ queryKey: ["inbox_items"] });
    },
  });

  const handleSubmit = () => {
    if (prioridades.length === 0) {
      setPrioridadeError(true);
      return;
    }
    if (!canSubmit) return;
    saveMutation.mutate();
  };

  const handleCancelEdit = () => {
    resetForm();
    editCtx?.clear();
  };


  return (
    <div
      className="rounded-2xl border bg-white p-5"
      style={{ borderColor: isEditing ? "#4F46E5" : "#EDEDED" }}
    >
      {isEditing && (
        <div
          className="mb-3 flex items-center justify-between rounded-lg px-3 py-2 text-[12px] font-medium"
          style={{ backgroundColor: "#EEF0FF", color: "#4F46E5" }}
        >
          <span>Editando item</span>
          <button
            type="button"
            onClick={handleCancelEdit}
            className="inline-flex items-center gap-1"
            style={{ color: "#4F46E5" }}
          >
            <X className="h-3.5 w-3.5" />
            Cancelar
          </button>
        </div>
      )}

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
      </div>

      {/* Prioridade */}
      <div className="mt-4">
        <div
          className="mb-2 text-[12px] font-semibold uppercase tracking-wider"
          style={{ color: "#6B7280" }}
        >
          Prioridade
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {PRIORIDADE_OPTIONS.map((opt) => {
            const active = prioridades.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => togglePrioridade(opt.value)}
                className="rounded-full px-3 py-1 text-[12px] font-medium transition-colors hover:bg-[#FAFAFA]"
                style={
                  active
                    ? { backgroundColor: "#4F46E5", color: "#FFFFFF" }
                    : { backgroundColor: "transparent", color: "#6B7280", border: "1px solid #EDEDED" }
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {prioridadeError && (
          <p className="mt-2 text-[12px]" style={{ color: "#B91C1C" }}>
            Selecione ao menos uma prioridade.
          </p>
        )}
      </div>

      {/* Dia a ser realizado */}
      <div className="mt-4">
        <div
          className="mb-2 text-[12px] font-semibold uppercase tracking-wider"
          style={{ color: "#6B7280" }}
        >
          Dia a ser realizado
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[160px]">
            <Select
              value={diaSemana}
              onValueChange={(v) => setDiaSemana(v as DiaSemana | "nenhum")}
            >
              <SelectTrigger className="h-9 rounded-full border-[#EDEDED] bg-[#FAFAFA] text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Nenhum</SelectItem>
                {DIA_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[11px]" style={{ color: "#B0B4BC" }}>
            Só planejamento — não dispara notificação no Telegram.
          </p>
        </div>
      </div>

      <div
        className="mt-4 flex flex-wrap items-center gap-3 border-t pt-3"
        style={{ borderColor: "#EDEDED" }}
      >
        <button
          type="button"
          role="switch"
          aria-checked={lembreteOn}
          onClick={() => {
            const next = !lembreteOn;
            setLembreteOn(next);
            if (next && !lembreteLocal) {
              const d = new Date(Date.now() + 60 * 60 * 1000);
              setLembreteLocal(toLocalInputValue(d));
            }
          }}
          className="flex items-center gap-2 text-[13px] font-medium"
          style={{ color: lembreteOn ? "#4F46E5" : "#6B7280" }}
        >
          <span
            className="relative inline-block h-5 w-9 rounded-full transition-colors"
            style={{ backgroundColor: lembreteOn ? "#4F46E5" : "#E5E7EB" }}
          >
            <span
              className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
              style={{ left: lembreteOn ? "18px" : "2px" }}
            />
          </span>
          <Bell className="h-3.5 w-3.5" />
          Adicionar lembrete
        </button>

        {lembreteOn && (
          <input
            type="datetime-local"
            value={lembreteLocal}
            onChange={(e) => setLembreteLocal(e.target.value)}
            className="h-9 rounded-full border bg-[#FAFAFA] px-3 text-[13px] outline-none focus:border-[#4F46E5]"
            style={{ borderColor: "#EDEDED", color: "#111111" }}
          />
        )}

        <div className="ml-auto flex items-center gap-2">
          {isEditing && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="inline-flex items-center gap-1 rounded-full border px-4 py-2 text-[13px] font-medium"
              style={{ borderColor: "#EDEDED", color: "#6B7280" }}
            >
              <X className="h-3.5 w-3.5" />
              Cancelar
            </button>
          )}
          <button
            type="button"
            disabled={saveMutation.isPending}
            onClick={handleSubmit}
            className="rounded-full px-5 py-2 text-[13px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: "#4F46E5" }}
          >
            {saveMutation.isPending
              ? isEditing
                ? "Salvando..."
                : "Adicionando..."
              : isEditing
                ? "Salvar"
                : "Adicionar"}
          </button>
        </div>

      </div>

      <TestReminderButton />
    </div>
  );
}

function TestReminderButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const resp = await fetch("/api/public/hooks/send-reminders", { method: "POST" });
      const json = await resp.json();
      setResult(JSON.stringify(json, null, 2));
    } catch (e) {
      setResult(`Erro: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 border-t pt-3" style={{ borderColor: "#EDEDED" }}>
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="rounded-full border px-3 py-1 text-[12px] font-medium disabled:opacity-50"
        style={{ borderColor: "#EDEDED", color: "#6B7280" }}
      >
        {loading ? "Testando..." : "Testar envio de lembretes agora"}
      </button>
      {result && (
        <pre
          className="mt-2 max-h-64 overflow-auto rounded-lg p-3 text-[11px]"
          style={{ backgroundColor: "#FAFAFA", color: "#111111" }}
        >
          {result}
        </pre>
      )}
    </div>
  );
}

function useInboxItems(areaFilter?: AreaValue) {
  return useQuery({
    queryKey: ["inbox_items", areaFilter ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("inbox_items")
        .select("*")
        .order("criado_em", { ascending: false });
      if (areaFilter) query = query.eq("area", areaFilter);
      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as InboxItem[]).map((i) => ({
        ...i,
        prioridades: (i.prioridades ?? []) as Prioridade[],
      }));
    },
  });
}

function ItemCard({
  item,
  onToggle,
  pending,
}: {
  item: InboxItem;
  onToggle: (item: InboxItem) => void;
  pending: boolean;
}) {
  const editCtx = useInboxEdit();
  const canEdit = editCtx !== null;
  const isEditingThis = editCtx?.editing?.id === item.id;
  return (
    <li
      className="flex items-start gap-3 rounded-xl border bg-white px-4 py-3 transition-opacity"
      style={{
        borderColor: isEditingThis ? "#4F46E5" : "#EDEDED",
        opacity: pending ? 1 : 0.5,
      }}
    >
      <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={!pending}
          onCheckedChange={() => onToggle(item)}
        />
      </div>
      <span
        className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: tipoDot(item.tipo) }}
        aria-label={item.tipo}
      />
      <div
        className="min-w-0 flex-1"
        role={canEdit ? "button" : undefined}
        tabIndex={canEdit ? 0 : undefined}
        onClick={canEdit ? () => editCtx!.startEdit(item) : undefined}
        onKeyDown={
          canEdit
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  editCtx!.startEdit(item);
                }
              }
            : undefined
        }
        style={canEdit ? { cursor: "pointer" } : undefined}
      >

        <p
          className="whitespace-pre-wrap break-words text-[14px]"
          style={{
            color: "#111111",
            textDecoration: !pending ? "line-through" : "none",
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
            style={{ backgroundColor: "#EEF0FF", color: "#4F46E5" }}
          >
            {areaLabel(item.area)}
          </span>
          {item.prioridades?.map((p) => {
            const s = prioridadeStyle(p);
            return (
              <span
                key={p}
                className="rounded-full px-2 py-0.5 font-medium"
                style={{ backgroundColor: s.bg, color: s.color }}
              >
                {prioridadeLabel(p)}
              </span>
            );
          })}
          {item.dia_semana && (
            <span
              className="rounded-full px-2 py-0.5 font-medium"
              style={{ backgroundColor: "#F5F5F5", color: "#6B7280" }}
              title="Dia planejado"
            >
              {diaLabel(item.dia_semana)}
            </span>
          )}
          {item.lembrete_data_hora && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
              style={
                item.lembrete_enviado
                  ? { backgroundColor: "#F5F5F5", color: "#B0B4BC" }
                  : { backgroundColor: "#FEF3C7", color: "#B45309" }
              }
              title={
                item.lembrete_enviado
                  ? "Lembrete já notificado"
                  : "Lembrete agendado"
              }
            >
              {item.lembrete_enviado ? (
                <Bell className="h-3 w-3" />
              ) : (
                <BellRing className="h-3 w-3" />
              )}
              {formatLembrete(item.lembrete_data_hora)}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function useToggle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: InboxItem) => {
      const pending = isItemPending(item);
      // If currently pending, mark done. If done, reopen.
      const { error } = await supabase
        .from("inbox_items")
        .update({ concluido: pending })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox_items"] }),
  });
}

export function TodayList() {
  const { data, isLoading } = useInboxItems();
  const toggle = useToggle();

  const todayItems = useMemo(() => {
    if (!data) return [];
    const today = todayDia();
    const seen = new Set<string>();
    const result: InboxItem[] = [];
    for (const item of data) {
      const matchesHoje = item.prioridades?.includes("hoje");
      const matchesDia =
        item.dia_semana === today && isItemPending(item);
      if ((matchesHoje || matchesDia) && !seen.has(item.id)) {
        seen.add(item.id);
        result.push(item);
      }
    }
    return result;
  }, [data]);

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2
          className="text-[13px] font-semibold uppercase tracking-wider"
          style={{ color: "#4F46E5" }}
        >
          Hoje
        </h2>
        <span className="text-[12px]" style={{ color: "#6B7280" }}>
          {todayItems.length} {todayItems.length === 1 ? "item" : "itens"}
        </span>
      </div>
      {isLoading ? (
        <div className="py-6 text-center text-[13px]" style={{ color: "#B0B4BC" }}>
          Carregando...
        </div>
      ) : todayItems.length === 0 ? (
        <div
          className="rounded-2xl border py-8 text-center text-[13px]"
          style={{ borderColor: "#EDEDED", color: "#B0B4BC" }}
        >
          Nada marcado para hoje.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {todayItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              pending={isItemPending(item)}
              onToggle={(i) => toggle.mutate(i)}
            />
          ))}
        </ul>
      )}
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
  const [showConcluidos, setShowConcluidos] = useState(false);
  const { data, isLoading } = useInboxItems(areaFilter);
  const toggle = useToggle();

  const visible = useMemo(() => {
    if (!data) return [];
    return showConcluidos ? data : data.filter((i) => isItemPending(i));
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
            <ItemCard
              key={item.id}
              item={item}
              pending={isItemPending(item)}
              onToggle={(i) => toggle.mutate(i)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
