import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Plus, Upload, ChevronDown, ChevronUp } from "lucide-react";
import { getCurrentUser } from "@/lib/auth.functions";
import {
  FRENTES,
  ORIGENS,
  PRIORIDADES,
  PROJETOS,
  RESPONSAVEIS,
  STATUS,
  STATUS_FECHADOS,
  TIPOS,
  areaMetasHabilitada,
  mensagemDeErro,
  rotulo,
  type Meta,
  type PreviaImportacao,
  type Prioridade,
  type Status,
} from "@/lib/metas";
import {
  atualizarMeta,
  confirmarImportacaoMetas,
  criarMeta,
  listarMetas,
  previaImportacaoMetas,
} from "@/lib/metas.functions";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/$area/metas")({
  beforeLoad: ({ params }) => {
    if (!areaMetasHabilitada(params.area)) throw notFound();
  },
  component: MetasPage,
});

// Minimal Mono
const COR = {
  texto: "#111111",
  secundario: "#6B7280",
  borda: "#EDEDED",
  fundo: "#FAFAFA",
  destaque: "#4F46E5",
  badge: "#EEF0FF",
};

const TODOS = "todos";

type AlteracoesMeta = {
  status?: Status;
  prioridade?: Prioridade;
  prazo?: string | null;
  detalhe?: string | null;
  resolucao?: string | null;
};

type DadosImportacao = { area: string; jsonText: string };

const EXEMPLO_JSON = `[
  {
    "tipo": "tarefa",
    "titulo": "Definir fornecedor de resina",
    "detalhe": "Comparar 3 orçamentos",
    "projeto": "Versa3D",
    "area": "tecnico",
    "responsaveis": ["Rafael"],
    "nome_terceiro": null,
    "prioridade": "importante",
    "prazo": "2026-12-15",
    "status": "a_fazer",
    "origem_discussao": "discutido_ambos",
    "fonte": "reunião 12/11"
  }
]`;

function formatarData(iso: string | null): string {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

function Pilula({ children, forte }: { children: ReactNode; forte?: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
      style={
        forte
          ? { backgroundColor: COR.badge, color: COR.destaque }
          : { backgroundColor: COR.fundo, color: COR.secundario, border: `1px solid ${COR.borda}` }
      }
    >
      {children}
    </span>
  );
}

function BotaoPrimario(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${props.className ?? ""}`}
      style={{ backgroundColor: COR.destaque, ...props.style }}
    />
  );
}

function BotaoSecundario(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-9 items-center gap-2 rounded-full border bg-white px-4 text-[13px] font-medium transition-colors hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-50 ${props.className ?? ""}`}
      style={{ borderColor: COR.borda, color: COR.texto, ...props.style }}
    />
  );
}

function Rotulo({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1 block text-[12px] font-medium" style={{ color: COR.secundario }}>
      {children}
    </label>
  );
}

function SelectSimples({
  value,
  onChange,
  opcoes,
  placeholder,
  incluirTodos,
  incluirVazio,
}: {
  value: string;
  onChange: (v: string) => void;
  opcoes: readonly string[];
  placeholder?: string;
  incluirTodos?: string;
  incluirVazio?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className="h-9 rounded-full bg-white text-[13px]"
        style={{ borderColor: COR.borda, color: COR.texto }}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {incluirTodos && <SelectItem value={TODOS}>{incluirTodos}</SelectItem>}
        {incluirVazio && <SelectItem value="__vazio">{incluirVazio}</SelectItem>}
        {opcoes.map((o) => (
          <SelectItem key={o} value={o}>
            {rotulo(o)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MetasPage() {
  const { area } = Route.useParams();
  const navigate = useNavigate();

  const fetchUser = useServerFn(getCurrentUser);
  const runListar = useServerFn(listarMetas);
  const runCriar = useServerFn(criarMeta);
  const runAtualizar = useServerFn(atualizarMeta);
  const runPrevia = useServerFn(previaImportacaoMetas);
  const runConfirmar = useServerFn(confirmarImportacaoMetas);

  const [isAdmin, setIsAdmin] = useState(false);
  const [checandoAcesso, setChecandoAcesso] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [metas, setMetas] = useState<Meta[]>([]);

  const [fProjeto, setFProjeto] = useState(TODOS);
  const [fTipo, setFTipo] = useState(TODOS);
  const [fStatus, setFStatus] = useState(TODOS);
  const [fPrioridade, setFPrioridade] = useState(TODOS);
  const [mostrarFechados, setMostrarFechados] = useState(false);

  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [novaAberta, setNovaAberta] = useState(false);
  const [importAberta, setImportAberta] = useState(false);

  // 1. Acesso: somente admin (o servidor e a RLS tambem conferem)
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const u = await fetchUser();
        if (!ativo) return;
        if (!u || u.role !== "admin") {
          toast.error("Acesso restrito a administradores");
          navigate({ to: "/" });
          return;
        }
        setIsAdmin(true);
      } catch {
        if (!ativo) return;
        toast.error("Acesso restrito a administradores");
        navigate({ to: "/" });
      } finally {
        if (ativo) setChecandoAcesso(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [fetchUser, navigate]);

  const carregar = async () => {
    setCarregando(true);
    try {
      setMetas(await runListar({ data: { area } }));
    } catch (e) {
      toast.error(mensagemDeErro(e, "Erro ao carregar metas"));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (isAdmin) void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, area]);

  const visiveis = useMemo(() => {
    const statusFechadoEscolhido = (STATUS_FECHADOS as string[]).includes(fStatus);
    return metas.filter((m) => {
      if (fProjeto !== TODOS && m.projeto !== fProjeto) return false;
      if (fTipo !== TODOS && m.tipo !== fTipo) return false;
      if (fStatus !== TODOS && m.status !== fStatus) return false;
      if (fPrioridade !== TODOS && m.prioridade !== fPrioridade) return false;
      if (!mostrarFechados && !statusFechadoEscolhido && STATUS_FECHADOS.includes(m.status)) {
        return false;
      }
      return true;
    });
  }, [metas, fProjeto, fTipo, fStatus, fPrioridade, mostrarFechados]);

  const qtdFechados = metas.filter((m) => STATUS_FECHADOS.includes(m.status)).length;
  const aberta = metas.find((m) => m.id === abertaId) ?? null;

  const substituir = (m: Meta) => setMetas((prev) => prev.map((x) => (x.id === m.id ? m : x)));

  if (checandoAcesso) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[13px]" style={{ color: COR.secundario }}>
          Verificando autorização...
        </p>
      </div>
    );
  }
  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      {/* Cabecalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: COR.texto, letterSpacing: "-0.02em" }}
          >
            Metas
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: COR.secundario }}>
            Objetivos de evolução desta área.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BotaoSecundario onClick={() => setImportAberta((v) => !v)}>
            <Upload className="h-4 w-4" />
            Importar JSON
            {importAberta ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </BotaoSecundario>
          <BotaoPrimario onClick={() => setNovaAberta(true)}>
            <Plus className="h-4 w-4" />
            Nova meta
          </BotaoPrimario>
        </div>
      </div>

      {importAberta && (
        <Importacao
          area={area}
          runPrevia={runPrevia}
          runConfirmar={runConfirmar}
          aoConcluir={() => void carregar()}
        />
      )}

      {/* Filtros */}
      <div
        className="grid grid-cols-2 gap-2 rounded-2xl border bg-white p-3 md:grid-cols-5"
        style={{ borderColor: COR.borda }}
      >
        <SelectSimples
          value={fProjeto}
          onChange={setFProjeto}
          opcoes={PROJETOS}
          incluirTodos="Todos os projetos"
        />
        <SelectSimples
          value={fTipo}
          onChange={setFTipo}
          opcoes={TIPOS}
          incluirTodos="Todos os tipos"
        />
        <SelectSimples
          value={fStatus}
          onChange={setFStatus}
          opcoes={STATUS}
          incluirTodos="Todos os status"
        />
        <SelectSimples
          value={fPrioridade}
          onChange={setFPrioridade}
          opcoes={PRIORIDADES}
          incluirTodos="Todas as prioridades"
        />
        <label
          className="col-span-2 inline-flex cursor-pointer items-center gap-2 px-2 text-[12px] md:col-span-1"
          style={{ color: COR.secundario }}
        >
          <input
            type="checkbox"
            checked={mostrarFechados}
            onChange={(e) => setMostrarFechados(e.target.checked)}
            className="h-4 w-4 accent-[#4F46E5]"
          />
          Mostrar concluídos e descartados ({qtdFechados})
        </label>
      </div>

      {/* Lista */}
      {carregando ? (
        <p className="text-[13px]" style={{ color: COR.secundario }}>
          Carregando...
        </p>
      ) : visiveis.length === 0 ? (
        <div
          className="rounded-2xl border bg-white px-6 py-12 text-center text-[13px]"
          style={{ borderColor: COR.borda, color: COR.secundario }}
        >
          {metas.length === 0
            ? "Nenhuma meta cadastrada nesta área."
            : "Nenhuma meta com estes filtros."}
        </div>
      ) : (
        <ul className="space-y-2">
          {visiveis.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setAbertaId(m.id)}
                className="w-full rounded-2xl border bg-white px-4 py-3 text-left transition-colors hover:bg-[#FAFAFA]"
                style={{ borderColor: COR.borda }}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pilula forte>{rotulo(m.tipo)}</Pilula>
                  <Pilula>{rotulo(m.status)}</Pilula>
                  <Pilula>{rotulo(m.prioridade)}</Pilula>
                  {m.prazo && <Pilula>Prazo {formatarData(m.prazo)}</Pilula>}
                </div>
                <div
                  className="mt-2 text-[14px] font-medium"
                  style={{
                    color: COR.texto,
                    textDecoration: STATUS_FECHADOS.includes(m.status) ? "line-through" : undefined,
                  }}
                >
                  {m.titulo}
                </div>
                <div className="mt-1 text-[12px]" style={{ color: COR.secundario }}>
                  {[
                    m.projeto,
                    m.frente,
                    m.responsaveis.length
                      ? m.responsaveis
                          .map((r) =>
                            r === "Terceiro" && m.nome_terceiro
                              ? `Terceiro (${m.nome_terceiro})`
                              : r,
                          )
                          .join(", ")
                      : "Sem responsável",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <DetalheMeta
        meta={aberta}
        area={area}
        aoFechar={() => setAbertaId(null)}
        aoSalvar={substituir}
        runAtualizar={runAtualizar}
      />

      <NovaMeta
        aberta={novaAberta}
        area={area}
        aoFechar={() => setNovaAberta(false)}
        aoCriar={(m) => setMetas((prev) => [m, ...prev])}
        runCriar={runCriar}
      />
    </div>
  );
}

// ---------------------------------------------------------------------
// Detalhe e edicao
// ---------------------------------------------------------------------

function DetalheMeta({
  meta,
  area,
  aoFechar,
  aoSalvar,
  runAtualizar,
}: {
  meta: Meta | null;
  area: string;
  aoFechar: () => void;
  aoSalvar: (m: Meta) => void;
  runAtualizar: (args: {
    data: { id: string; area: string; alteracoes: AlteracoesMeta };
  }) => Promise<Meta>;
}) {
  const [status, setStatus] = useState("");
  const [prioridade, setPrioridade] = useState("");
  const [prazo, setPrazo] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [resolucao, setResolucao] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!meta) return;
    setStatus(meta.status);
    setPrioridade(meta.prioridade);
    setPrazo(meta.prazo ?? "");
    setDetalhe(meta.detalhe ?? "");
    setResolucao(meta.resolucao ?? "");
  }, [meta?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvar = async () => {
    if (!meta) return;
    const alteracoes: AlteracoesMeta = {};
    if (status !== meta.status) alteracoes.status = status as Status;
    if (prioridade !== meta.prioridade) alteracoes.prioridade = prioridade as Prioridade;
    if ((prazo || null) !== meta.prazo) alteracoes.prazo = prazo || null;
    if ((detalhe.trim() || null) !== meta.detalhe) alteracoes.detalhe = detalhe.trim() || null;
    if ((resolucao.trim() || null) !== meta.resolucao)
      alteracoes.resolucao = resolucao.trim() || null;
    if (Object.keys(alteracoes).length === 0) {
      toast("Nada foi alterado.");
      return;
    }
    setSalvando(true);
    try {
      const atualizada = await runAtualizar({ data: { id: meta.id, area, alteracoes } });
      aoSalvar(atualizada);
      toast.success("Meta atualizada");
    } catch (e) {
      toast.error(mensagemDeErro(e, "Erro ao salvar"));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Sheet open={!!meta} onOpenChange={(o) => !o && aoFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {meta && (
          <div className="space-y-5">
            <SheetHeader>
              <div className="flex flex-wrap gap-1.5">
                <Pilula forte>{rotulo(meta.tipo)}</Pilula>
                <Pilula>{meta.projeto}</Pilula>
                {meta.frente && <Pilula>{meta.frente}</Pilula>}
              </div>
              <SheetTitle className="text-left text-lg" style={{ color: COR.texto }}>
                {meta.titulo}
              </SheetTitle>
              <SheetDescription className="text-left text-[12px]" style={{ color: COR.secundario }}>
                {[
                  meta.responsaveis.length
                    ? `Responsáveis: ${meta.responsaveis.join(", ")}`
                    : "Sem responsável",
                  meta.nome_terceiro ? `Terceiro: ${meta.nome_terceiro}` : null,
                  meta.origem_discussao ? rotulo(meta.origem_discussao) : null,
                  meta.fonte ? `Fonte: ${meta.fonte}` : null,
                  meta.concluido_em ? `Concluído em ${formatarData(meta.concluido_em)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </SheetDescription>
            </SheetHeader>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Rotulo>Status</Rotulo>
                <SelectSimples value={status} onChange={setStatus} opcoes={STATUS} />
              </div>
              <div>
                <Rotulo>Prioridade</Rotulo>
                <SelectSimples value={prioridade} onChange={setPrioridade} opcoes={PRIORIDADES} />
              </div>
              <div className="col-span-2">
                <Rotulo>Prazo</Rotulo>
                <Input
                  type="date"
                  value={prazo}
                  onChange={(e) => setPrazo(e.target.value)}
                  className="h-9 rounded-full text-[13px]"
                  style={{ borderColor: COR.borda }}
                />
              </div>
            </div>

            <div>
              <Rotulo>Detalhe</Rotulo>
              <Textarea
                value={detalhe}
                onChange={(e) => setDetalhe(e.target.value)}
                rows={5}
                className="text-[13px]"
                style={{ borderColor: COR.borda }}
              />
            </div>

            <div>
              <Rotulo>Resolução (o que foi decidido ou como foi resolvido)</Rotulo>
              <Textarea
                value={resolucao}
                onChange={(e) => setResolucao(e.target.value)}
                rows={4}
                className="text-[13px]"
                style={{ borderColor: COR.borda }}
              />
            </div>

            <div className="flex justify-end gap-2">
              <BotaoSecundario onClick={aoFechar}>Fechar</BotaoSecundario>
              <BotaoPrimario onClick={salvar} disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar"}
              </BotaoPrimario>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------
// Nova meta
// ---------------------------------------------------------------------

const FORM_VAZIO = {
  tipo: "tarefa",
  titulo: "",
  detalhe: "",
  projeto: "",
  area: "__vazio",
  responsaveis: [] as string[],
  nome_terceiro: "",
  prioridade: "importante",
  prazo: "",
  status: "backlog",
  origem_discussao: "__vazio",
  fonte: "",
};

function NovaMeta({
  aberta,
  area,
  aoFechar,
  aoCriar,
  runCriar,
}: {
  aberta: boolean;
  area: string;
  aoFechar: () => void;
  aoCriar: (m: Meta) => void;
  runCriar: (args: { data: { area: string; item: Record<string, unknown> } }) => Promise<Meta>;
}) {
  const [f, setF] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (aberta) setF(FORM_VAZIO);
  }, [aberta]);

  const set = (k: keyof typeof FORM_VAZIO) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const alternarResp = (r: string) =>
    setF((p) => ({
      ...p,
      responsaveis: p.responsaveis.includes(r)
        ? p.responsaveis.filter((x) => x !== r)
        : [...p.responsaveis, r],
    }));

  const salvar = async () => {
    setSalvando(true);
    try {
      const item = {
        ...f,
        area: f.area === "__vazio" ? null : f.area,
        origem_discussao: f.origem_discussao === "__vazio" ? null : f.origem_discussao,
        nome_terceiro: f.responsaveis.includes("Terceiro") ? f.nome_terceiro : null,
      };
      const criada = await runCriar({ data: { area, item } });
      aoCriar(criada);
      toast.success("Meta criada");
      aoFechar();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Erro ao criar meta"));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberta} onOpenChange={(o) => !o && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle style={{ color: COR.texto }}>Nova meta</DialogTitle>
          <DialogDescription className="text-[12px]" style={{ color: COR.secundario }}>
            Título, projeto, tipo e prioridade são obrigatórios.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Rotulo>Título</Rotulo>
            <Input
              value={f.titulo}
              onChange={(e) => set("titulo")(e.target.value)}
              className="h-9 rounded-full text-[13px]"
              style={{ borderColor: COR.borda }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Rotulo>Tipo</Rotulo>
              <SelectSimples value={f.tipo} onChange={set("tipo")} opcoes={TIPOS} />
            </div>
            <div>
              <Rotulo>Projeto</Rotulo>
              <SelectSimples
                value={f.projeto}
                onChange={set("projeto")}
                opcoes={PROJETOS}
                placeholder="Escolha"
              />
            </div>
            <div>
              <Rotulo>Frente</Rotulo>
              <SelectSimples
                value={f.area}
                onChange={set("area")}
                opcoes={FRENTES}
                incluirVazio="Sem frente"
              />
            </div>
            <div>
              <Rotulo>Prioridade</Rotulo>
              <SelectSimples
                value={f.prioridade}
                onChange={set("prioridade")}
                opcoes={PRIORIDADES}
              />
            </div>
            <div>
              <Rotulo>Status</Rotulo>
              <SelectSimples value={f.status} onChange={set("status")} opcoes={STATUS} />
            </div>
            <div>
              <Rotulo>Prazo</Rotulo>
              <Input
                type="date"
                value={f.prazo}
                onChange={(e) => set("prazo")(e.target.value)}
                className="h-9 rounded-full text-[13px]"
                style={{ borderColor: COR.borda }}
              />
            </div>
          </div>

          <div>
            <Rotulo>Responsáveis</Rotulo>
            <div className="flex flex-wrap gap-1.5">
              {RESPONSAVEIS.map((r) => {
                const ativo = f.responsaveis.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => alternarResp(r)}
                    className="rounded-full border px-3 py-1 text-[12px] font-medium"
                    style={
                      ativo
                        ? {
                            backgroundColor: COR.destaque,
                            borderColor: COR.destaque,
                            color: "#FFFFFF",
                          }
                        : {
                            backgroundColor: "#FFFFFF",
                            borderColor: COR.borda,
                            color: COR.secundario,
                          }
                    }
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>

          {f.responsaveis.includes("Terceiro") && (
            <div>
              <Rotulo>Nome do terceiro</Rotulo>
              <Input
                value={f.nome_terceiro}
                onChange={(e) => set("nome_terceiro")(e.target.value)}
                className="h-9 rounded-full text-[13px]"
                style={{ borderColor: COR.borda }}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Rotulo>Origem</Rotulo>
              <SelectSimples
                value={f.origem_discussao}
                onChange={set("origem_discussao")}
                opcoes={ORIGENS}
                incluirVazio="Não informada"
              />
            </div>
            <div>
              <Rotulo>Fonte</Rotulo>
              <Input
                value={f.fonte}
                onChange={(e) => set("fonte")(e.target.value)}
                className="h-9 rounded-full text-[13px]"
                style={{ borderColor: COR.borda }}
              />
            </div>
          </div>

          <div>
            <Rotulo>Detalhe</Rotulo>
            <Textarea
              value={f.detalhe}
              onChange={(e) => set("detalhe")(e.target.value)}
              rows={4}
              className="text-[13px]"
              style={{ borderColor: COR.borda }}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <BotaoSecundario onClick={aoFechar}>Cancelar</BotaoSecundario>
            <BotaoPrimario onClick={salvar} disabled={salvando || !f.titulo.trim() || !f.projeto}>
              {salvando ? "Salvando..." : "Criar meta"}
            </BotaoPrimario>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// Importacao em 2 etapas
// ---------------------------------------------------------------------

function Importacao({
  area,
  runPrevia,
  runConfirmar,
  aoConcluir,
}: {
  area: string;
  runPrevia: (args: { data: DadosImportacao }) => Promise<PreviaImportacao>;
  runConfirmar: (args: { data: DadosImportacao }) => Promise<{
    inseridos: number;
    ignoradosNaGravacao: number;
    duplicados: number;
    invalidos: number;
  }>;
  aoConcluir: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [previa, setPrevia] = useState<PreviaImportacao | null>(null);
  const [textoDaPrevia, setTextoDaPrevia] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const previaValida = previa?.ok && textoDaPrevia === texto;

  const gerarPrevia = async () => {
    setOcupado(true);
    try {
      const r = await runPrevia({ data: { area, jsonText: texto } });
      setPrevia(r);
      setTextoDaPrevia(texto);
      if (!r.ok) toast.error(r.erroGeral ?? "Lote inválido");
    } catch (e) {
      toast.error(mensagemDeErro(e, "Erro na prévia"));
    } finally {
      setOcupado(false);
    }
  };

  const confirmar = async () => {
    setOcupado(true);
    try {
      const r = await runConfirmar({ data: { area, jsonText: texto } });
      const extra = r.ignoradosNaGravacao
        ? `, ${r.ignoradosNaGravacao} já existiam no momento da gravação`
        : "";
      toast.success(`${r.inseridos} meta(s) gravada(s)${extra}`);
      setTexto("");
      setPrevia(null);
      setTextoDaPrevia("");
      aoConcluir();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Erro ao gravar"));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border bg-white p-4" style={{ borderColor: COR.borda }}>
      <div>
        <h2 className="text-[14px] font-semibold" style={{ color: COR.texto }}>
          Importar metas (JSON)
        </h2>
        <p className="mt-1 text-[12px]" style={{ color: COR.secundario }}>
          Cole um array JSON. Campos: tipo, titulo, detalhe, projeto, area (vira a frente),
          responsaveis, nome_terceiro, prioridade, prazo, status, origem_discussao, fonte. Acentos e
          maiúsculas são ignorados. Itens já existentes nunca são alterados.
        </p>
      </div>

      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={EXEMPLO_JSON}
        rows={10}
        className="font-mono text-[12px]"
        style={{ borderColor: COR.borda }}
      />

      <div className="flex flex-wrap gap-2">
        <BotaoSecundario onClick={gerarPrevia} disabled={ocupado || !texto.trim()}>
          1. Gerar prévia
        </BotaoSecundario>
        <BotaoPrimario
          onClick={confirmar}
          disabled={ocupado || !previaValida || (previa?.novos.length ?? 0) === 0}
        >
          2. Confirmar e gravar {previaValida ? `(${previa!.novos.length})` : ""}
        </BotaoPrimario>
      </div>

      {previa && textoDaPrevia !== texto && (
        <p className="text-[12px]" style={{ color: COR.secundario }}>
          O texto mudou depois da prévia. Gere a prévia de novo antes de confirmar.
        </p>
      )}

      {previa?.ok && (
        <div className="grid gap-3 md:grid-cols-3">
          <GrupoPrevia titulo={`Novos (${previa.novos.length})`} destaque>
            {previa.novos.map((n) => (
              <li key={n.indice}>
                <span style={{ color: COR.secundario }}>#{n.indice}</span> {n.meta.titulo}
                <div style={{ color: COR.secundario }}>
                  {[
                    n.meta.projeto,
                    rotulo(n.meta.tipo),
                    rotulo(n.meta.prioridade),
                    rotulo(n.meta.status),
                  ].join(" · ")}
                </div>
              </li>
            ))}
          </GrupoPrevia>
          <GrupoPrevia titulo={`Duplicados ignorados (${previa.duplicados.length})`}>
            {previa.duplicados.map((d) => (
              <li key={d.indice}>
                <span style={{ color: COR.secundario }}>#{d.indice}</span> {d.titulo}
                <div style={{ color: COR.secundario }}>
                  {d.projeto} · {d.motivo}
                </div>
              </li>
            ))}
          </GrupoPrevia>
          <GrupoPrevia titulo={`Inválidos (${previa.invalidos.length})`}>
            {previa.invalidos.map((i) => (
              <li key={i.indice}>
                <span style={{ color: COR.secundario }}>#{i.indice}</span>{" "}
                {i.titulo || "(sem título)"}
                <ul className="mt-0.5 list-disc pl-4 text-[#B91C1C]">
                  {i.motivos.map((m, k) => (
                    <li key={k}>{m}</li>
                  ))}
                </ul>
              </li>
            ))}
          </GrupoPrevia>
        </div>
      )}
    </div>
  );
}

function GrupoPrevia({
  titulo,
  destaque,
  children,
}: {
  titulo: string;
  destaque?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: COR.borda, backgroundColor: COR.fundo }}
    >
      <div
        className="mb-2 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: destaque ? COR.destaque : COR.secundario, letterSpacing: "0.08em" }}
      >
        {titulo}
      </div>
      <ul className="max-h-72 space-y-2 overflow-y-auto text-[12px]" style={{ color: COR.texto }}>
        {children}
      </ul>
    </div>
  );
}
