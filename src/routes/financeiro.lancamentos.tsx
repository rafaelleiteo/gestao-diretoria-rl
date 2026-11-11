import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useMemo } from "react";
import {
  FileUp,
  FolderCog,
  Check,
  RotateCcw,
  Trash2,
  Plus,
  Search,
  Filter,
  X,
  CheckSquare,
  Square,
  AlertTriangle,
  Download,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { getCurrentUser } from "@/lib/auth.functions";
import {
  getFinanceiroAreas,
  createFinanceiroArea,
  deactivateFinanceiroArea,
  getLancamentos,
  importLancamentosLote,
  updateLancamento,
  deleteLancamento,
  validarLancamentos,
  voltarParaPendente,
  getFornecedoresConhecidos,
} from "@/lib/lancamentos.functions";

export const Route = createFileRoute("/financeiro/lancamentos")({
  head: () => ({
    meta: [
      { title: "Lançamentos — Financeiro — Rafael Leite" },
      { name: "description", content: "Módulo de lançamentos e aprendizado financeiro." },
    ],
  }),
  component: LancamentosPage,
});

const FIXO_VARIAVEL_OPTIONS = [
  { value: "fixo", label: "Fixo" },
  { value: "variavel", label: "Variável" },
  { value: "a_definir", label: "A definir" },
  { value: "indiferente", label: "Indiferente" },
];

const CARNE_LEAO_OPTIONS = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
  { value: "indiferente", label: "Indiferente" },
  { value: "a_definir", label: "A definir" },
];

function LancamentosPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"pendente" | "validado">("pendente");
  const [user, setUser] = useState<any>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Data state
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    createdCount: number;
    supplierSuggestedCount: number;
    errorCount: number;
    errors: string[];
  } | null>(null);

  const [isAreasModalOpen, setIsAreasModalOpen] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [isCreatingArea, setIsCreatingArea] = useState(false);

  // Export Padrões state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportText, setExportText] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [isLoadingExport, setIsLoadingExport] = useState(false);

  // Filters
  const [filterArea, setFilterArea] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("");
  const [filterCompetencia, setFilterCompetencia] = useState("");
  const [filterPago, setFilterPago] = useState<"todos" | "pago" | "nao_pago">("todos");
  const [filterResponsavel, setFilterResponsavel] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Server functions
  const fetchUser = useServerFn(getCurrentUser);
  const fetchAreas = useServerFn(getFinanceiroAreas);
  const fetchLancamentos = useServerFn(getLancamentos);
  const fetchFornecedores = useServerFn(getFornecedoresConhecidos);
  const runCreateArea = useServerFn(createFinanceiroArea);
  const runDeactivateArea = useServerFn(deactivateFinanceiroArea);
  const runImportLote = useServerFn(importLancamentosLote);
  const runUpdate = useServerFn(updateLancamento);
  const runDelete = useServerFn(deleteLancamento);
  const runValidar = useServerFn(validarLancamentos);
  const runVoltarPendente = useServerFn(voltarParaPendente);

  const handleExportPadroes = async () => {
    setIsLoadingExport(true);
    setIsExportModalOpen(true);
    setIsCopied(false);
    try {
      const list = await fetchFornecedores();
      if (!list || list.length === 0) {
        setExportText("Nenhum padrão aprendido ainda. Valide lançamentos para começar a aprender.");
      } else {
        const header = "| Fornecedor | Categoria | Área | Responsável | Fixo/Variável | Carnê Leão | Divide |";
        const separator = "|---|---|---|---|---|---|---|";
        const rows = list.map((f: any) => {
          const fornecedor = f.padrao_nome || "?";
          const categoria = f.categoria || "?";
          const area = f.area || "?";
          const responsavel = f.responsavel || "?";
          const fixoVariavel = f.fixo_variavel || "?";
          const carneLeao = f.carne_leao || "?";
          const divide = f.divide || "?";
          return `| ${fornecedor} | ${categoria} | ${area} | ${responsavel} | ${fixoVariavel} | ${carneLeao} | ${divide} |`;
        });
        setExportText([header, separator, ...rows].join("\n"));
      }
    } catch (err: any) {
      toast.error("Erro ao carregar padrões aprendidos: " + err.message);
      setExportText("");
    } finally {
      setIsLoadingExport(false);
    }
  };

  const handleCopyExportText = () => {
    if (!exportText) return;
    navigator.clipboard.writeText(exportText);
    setIsCopied(true);
    toast.success("Copiado ✓");
    setTimeout(() => setIsCopied(false), 2000);
  };

  // 1. Auth Guard
  useEffect(() => {
    let active = true;
    async function checkAuth() {
      try {
        const u = await fetchUser();
        if (!active) return;
        setUser(u);
        if (!u || u.role !== "admin") {
          toast.error("Acesso restrito a administradores");
          navigate({ to: "/" });
          return;
        }
      } catch {
        if (!active) return;
        toast.error("Acesso restrito a administradores");
        navigate({ to: "/" });
      } finally {
        if (active) setIsLoadingAuth(false);
      }
    }
    void checkAuth();
    return () => {
      active = false;
    };
  }, [fetchUser, navigate]);

  // 2. Load Data
  const loadData = async (statusTab: "pendente" | "validado") => {
    setIsLoading(true);
    setSelectedIds([]);
    try {
      const [areasRes, itemsRes] = await Promise.all([
        fetchAreas(),
        fetchLancamentos({ data: { status: statusTab } }),
      ]);
      setAreas(areasRes);
      setLancamentos(itemsRes);
    } catch (err: any) {
      toast.error("Erro ao carregar dados: " + (err.message || "Erro desconhecido"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoadingAuth && user?.role === "admin") {
      void loadData(activeTab);
    }
  }, [activeTab, isLoadingAuth, user]);

  // Active areas options
  const activeAreas = useMemo(() => areas.filter((a) => a.ativo), [areas]);

  // Filtered lancamentos
  const filteredLancamentos = useMemo(() => {
    return lancamentos.filter((item) => {
      if (filterArea && item.area !== filterArea) return false;
      if (
        filterCategoria &&
        !item.categoria?.toLowerCase().includes(filterCategoria.toLowerCase())
      )
        return false;
      if (
        filterCompetencia &&
        !item.competencia?.toLowerCase().includes(filterCompetencia.toLowerCase())
      )
        return false;
      if (filterPago === "pago" && !item.pago) return false;
      if (filterPago === "nao_pago" && item.pago) return false;
      if (
        filterResponsavel &&
        !item.responsavel?.toLowerCase().includes(filterResponsavel.toLowerCase())
      )
        return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchEmpresa = item.empresa?.toLowerCase().includes(q);
        const matchDesc = item.descricao?.toLowerCase().includes(q);
        if (!matchEmpresa && !matchDesc) return false;
      }
      return true;
    });
  }, [
    lancamentos,
    filterArea,
    filterCategoria,
    filterCompetencia,
    filterPago,
    filterResponsavel,
    searchQuery,
  ]);

  // Selection handlers
  const allSelected =
    filteredLancamentos.length > 0 &&
    filteredLancamentos.every((item) => selectedIds.includes(item.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLancamentos.map((item) => item.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Inline Field Edit Handler
  const handleFieldChange = async (id: string, field: string, value: any) => {
    setLancamentos((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );

    try {
      await runUpdate({ data: { id, changes: { [field]: value } } });
    } catch (err: any) {
      toast.error("Erro ao salvar alteração: " + err.message);
      void loadData(activeTab);
    }
  };

  // Delete Handler
  const handleDelete = async (id: string) => {
    if (!window.confirm("Deseja realmente excluir este lançamento pendente?")) return;
    try {
      await runDelete({ data: id });
      toast.success("Lançamento excluído com sucesso.");
      setLancamentos((prev) => prev.filter((i) => i.id !== id));
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    } catch (err: any) {
      toast.error("Erro ao excluir: " + err.message);
    }
  };

  // Validate Handlers
  const handleValidarBatch = async (targetIds: string[]) => {
    if (targetIds.length === 0) return;
    try {
      const res = await runValidar({ data: { ids: targetIds } });
      toast.success(`${res.validatedCount} lançamento(s) validado(s) com aprendizado de fornecedor!`);
      void loadData(activeTab);
    } catch (err: any) {
      toast.error("Erro ao validar: " + err.message);
    }
  };

  // Voltar para Pendente Handler
  const handleVoltarPendenteBatch = async (targetIds: string[]) => {
    if (targetIds.length === 0) return;
    try {
      await runVoltarPendente({ data: { ids: targetIds } });
      toast.success(`${targetIds.length} lançamento(s) retornado(s) para pendentes.`);
      void loadData(activeTab);
    } catch (err: any) {
      toast.error("Erro ao alterar status: " + err.message);
    }
  };

  // Import Handler
  const handleImportJson = async () => {
    if (!importJsonText.trim()) {
      toast.error("Cole o JSON de lançamentos no campo de texto.");
      return;
    }
    setIsImporting(true);
    setImportResult(null);
    try {
      const res = await runImportLote({ data: { jsonText: importJsonText } });
      if (res.ok) {
        setImportResult({
          createdCount: res.createdCount,
          supplierSuggestedCount: res.supplierSuggestedCount,
          errorCount: res.errorCount,
          errors: res.errors,
        });
        toast.success(
          `${res.createdCount} lançamentos criados (${res.supplierSuggestedCount} usando sugestão de fornecedor conhecido), ${res.errorCount} com erro`
        );
        if (res.errorCount === 0) {
          setIsImportModalOpen(false);
          setImportJsonText("");
        }
        void loadData("pendente");
      } else {
        toast.error("Erro ao importar: " + res.error);
        setImportResult({
          createdCount: 0,
          supplierSuggestedCount: 0,
          errorCount: res.errorCount,
          errors: res.errors || [res.error || "Erro desconhecido"],
        });
      }
    } catch (err: any) {
      toast.error("Erro ao importar lote: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  // Area Management Handlers
  const handleCreateArea = async () => {
    if (!newAreaName.trim()) return;
    setIsCreatingArea(true);
    try {
      await runCreateArea({ data: { nome: newAreaName.trim() } });
      toast.success(`Área "${newAreaName.trim()}" criada!`);
      setNewAreaName("");
      const updated = await fetchAreas();
      setAreas(updated);
    } catch (err: any) {
      toast.error("Erro ao criar área: " + err.message);
    } finally {
      setIsCreatingArea(false);
    }
  };

  const handleDeactivateArea = async (id: string, nome: string) => {
    if (!window.confirm(`Deseja desativar a área "${nome}"? (Lançamentos existentes mantêm o histórico)`)) return;
    try {
      await runDeactivateArea({ data: { id } });
      toast.success(`Área "${nome}" desativada.`);
      const updated = await fetchAreas();
      setAreas(updated);
    } catch (err: any) {
      toast.error("Erro ao desativar área: " + err.message);
    }
  };

  const sampleJsonText = `[
  {
    "data": "02/01/2026",
    "competencia": "01/2026",
    "empresa": "Fabiana da Silva Almeida",
    "descricao": "PIX enviado Fabiana da Silva Almeida",
    "categoria": "Laboratório",
    "area": "Consultório",
    "valor": 2200.00,
    "pago": true,
    "forma_pagamento": "Santander",
    "responsavel": null,
    "fixo_variavel": null,
    "carne_leao": null,
    "observacao": null,
    "divide": null,
    "parcelas_totais": 1,
    "valor_total": 2200.00
  }
]`;

  if (isLoadingAuth || (!user && isLoadingAuth)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[13px] text-gray-500">Verificando autorização...</p>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "#111111", letterSpacing: "-0.02em" }}
          >
            Lançamentos Financeiros
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "#6B7280" }}>
            Importação em lote, conciliação e aprendizado contínuo de fornecedores conhecidos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportPadroes}
            className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors"
            style={{ borderColor: "#EDEDED", color: "#374151", backgroundColor: "#FFFFFF" }}
          >
            <Download size={14} />
            Exportar Padrões Aprendidos
          </button>

          <button
            type="button"
            onClick={() => setIsAreasModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors"
            style={{ borderColor: "#EDEDED", color: "#374151", backgroundColor: "#FFFFFF" }}
          >
            <FolderCog size={14} />
            Gerenciar Áreas
          </button>

          <button
            type="button"
            onClick={() => {
              setImportResult(null);
              setIsImportModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium text-white transition-colors"
            style={{ backgroundColor: "#4F46E5" }}
          >
            <FileUp size={14} />
            Importar lote (JSON)
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: "#EDEDED" }}>
        <button
          type="button"
          onClick={() => setActiveTab("pendente")}
          className="border-b-2 px-4 py-2 text-[13px] font-semibold transition-colors"
          style={
            activeTab === "pendente"
              ? { borderColor: "#4F46E5", color: "#4F46E5" }
              : { borderColor: "transparent", color: "#6B7280" }
          }
        >
          Pendentes
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("validado")}
          className="border-b-2 px-4 py-2 text-[13px] font-semibold transition-colors"
          style={
            activeTab === "validado"
              ? { borderColor: "#4F46E5", color: "#4F46E5" }
              : { borderColor: "transparent", color: "#6B7280" }
          }
        >
          Validados
        </button>
      </div>

      {/* Filters Bar */}
      <div
        className="rounded-2xl border p-4 space-y-3 bg-white"
        style={{ borderColor: "#EDEDED" }}
      >
        <div className="flex items-center gap-2 text-[12px] font-semibold text-gray-700">
          <Filter size={14} />
          Filtros de Pesquisa
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {/* Busca Texto */}
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-2.5 text-gray-400"
            />
            <input
              type="text"
              placeholder="Empresa / Descrição..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border bg-white pl-8 pr-2.5 py-1.5 text-[12px] text-gray-900 outline-none focus:border-indigo-600"
              style={{ borderColor: "#EDEDED" }}
            />
          </div>

          {/* Área */}
          <select
            value={filterArea}
            onChange={(e) => setFilterArea(e.target.value)}
            className="w-full rounded-xl border bg-white px-2.5 py-1.5 text-[12px] text-gray-900 outline-none focus:border-indigo-600"
            style={{ borderColor: "#EDEDED" }}
          >
            <option value="">Todas as Áreas</option>
            {areas.map((a) => (
              <option key={a.id} value={a.nome}>
                {a.nome} {!a.ativo ? "(Inativa)" : ""}
              </option>
            ))}
          </select>

          {/* Categoria */}
          <input
            type="text"
            placeholder="Categoria..."
            value={filterCategoria}
            onChange={(e) => setFilterCategoria(e.target.value)}
            className="w-full rounded-xl border bg-white px-2.5 py-1.5 text-[12px] text-gray-900 outline-none focus:border-indigo-600"
            style={{ borderColor: "#EDEDED" }}
          />

          {/* Competência */}
          <input
            type="text"
            placeholder="Competência (MM/AAAA)..."
            value={filterCompetencia}
            onChange={(e) => setFilterCompetencia(e.target.value)}
            className="w-full rounded-xl border bg-white px-2.5 py-1.5 text-[12px] text-gray-900 outline-none focus:border-indigo-600"
            style={{ borderColor: "#EDEDED" }}
          />

          {/* Pago */}
          <select
            value={filterPago}
            onChange={(e: any) => setFilterPago(e.target.value)}
            className="w-full rounded-xl border bg-white px-2.5 py-1.5 text-[12px] text-gray-900 outline-none focus:border-indigo-600"
            style={{ borderColor: "#EDEDED" }}
          >
            <option value="todos">Status Pago: Todos</option>
            <option value="pago">Pago: Sim</option>
            <option value="nao_pago">Pago: Não</option>
          </select>

          {/* Responsável */}
          <input
            type="text"
            placeholder="Responsável..."
            value={filterResponsavel}
            onChange={(e) => setFilterResponsavel(e.target.value)}
            className="w-full rounded-xl border bg-white px-2.5 py-1.5 text-[12px] text-gray-900 outline-none focus:border-indigo-600"
            style={{ borderColor: "#EDEDED" }}
          />
        </div>

        {(filterArea ||
          filterCategoria ||
          filterCompetencia ||
          filterPago !== "todos" ||
          filterResponsavel ||
          searchQuery) && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => {
                setFilterArea("");
                setFilterCategoria("");
                setFilterCompetencia("");
                setFilterPago("todos");
                setFilterResponsavel("");
                setSearchQuery("");
              }}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:underline"
            >
              <X size={12} /> Limpar filtros
            </button>
          </div>
        )}
      </div>

      {/* Action bar when items selected */}
      {selectedIds.length > 0 && (
        <div
          className="flex items-center justify-between rounded-xl border px-4 py-2.5 bg-indigo-50"
          style={{ borderColor: "#C7D2FE" }}
        >
          <span className="text-[12px] font-semibold text-indigo-900">
            {selectedIds.length} item(ns) selecionado(s)
          </span>

          <div className="flex items-center gap-2">
            {activeTab === "pendente" ? (
              <button
                type="button"
                onClick={() => handleValidarBatch(selectedIds)}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[12px] font-medium text-white shadow-xs transition-colors"
                style={{ backgroundColor: "#059669" }}
              >
                <Check size={14} />
                Validar selecionados ({selectedIds.length})
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleVoltarPendenteBatch(selectedIds)}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[12px] font-medium text-white shadow-xs transition-colors"
                style={{ backgroundColor: "#D97706" }}
              >
                <RotateCcw size={14} />
                Voltar selecionados para pendente
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Table */}
      <div
        className="overflow-x-auto rounded-2xl border bg-white"
        style={{ borderColor: "#EDEDED" }}
      >
        <table className="w-full text-left text-[12px]">
          <thead
            className="border-b text-[11px] font-semibold uppercase tracking-wider bg-gray-50"
            style={{ borderColor: "#EDEDED", color: "#6B7280" }}
          >
            <tr>
              <th className="px-3 py-3 w-8 text-center">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-gray-500 hover:text-gray-900"
                >
                  {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                </button>
              </th>
              <th className="px-3 py-3 min-w-[105px]">Data</th>
              <th className="px-3 py-3 min-w-[90px]">Compet.</th>
              <th className="px-3 py-3 min-w-[150px]">Empresa</th>
              <th className="px-3 py-3 min-w-[160px]">Descrição</th>
              <th className="px-3 py-3 min-w-[110px]">Categoria</th>
              <th className="px-3 py-3 min-w-[130px]">Área</th>
              <th className="px-3 py-3 min-w-[95px]">Valor</th>
              <th className="px-3 py-3 min-w-[65px] text-center">Pago</th>
              <th className="px-3 py-3 min-w-[110px]">Forma Pag.</th>
              <th className="px-3 py-3 min-w-[110px]">Responsável</th>
              <th className="px-3 py-3 min-w-[110px]">Fixo/Var.</th>
              <th className="px-3 py-3 min-w-[110px]">Carnê Leão</th>
              <th className="px-3 py-3 min-w-[120px]">Observação</th>
              <th className="px-3 py-3 min-w-[90px]">Divide</th>
              <th className="px-3 py-3 min-w-[75px] text-center">Parcelas</th>
              <th className="px-3 py-3 min-w-[95px]">Valor Total</th>
              <th className="px-3 py-3 min-w-[120px] text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "#EDEDED" }}>
            {isLoading ? (
              <tr>
                <td colSpan={18} className="py-12 text-center text-gray-500">
                  Carregando lançamentos...
                </td>
              </tr>
            ) : filteredLancamentos.length === 0 ? (
              <tr>
                <td colSpan={18} className="py-12 text-center text-gray-500">
                  Nenhum lançamento encontrado nesta aba.
                </td>
              </tr>
            ) : (
              filteredLancamentos.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <tr
                    key={item.id}
                    className={`transition-colors hover:bg-gray-50/80 ${
                      isSelected ? "bg-indigo-50/50" : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => toggleSelectOne(item.id)}
                        className="text-gray-500 hover:text-gray-900"
                      >
                        {isSelected ? <CheckSquare size={14} className="text-indigo-600" /> : <Square size={14} />}
                      </button>
                    </td>

                    {/* Data */}
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={item.data || ""}
                        onChange={(e) => handleFieldChange(item.id, "data", e.target.value)}
                        className="w-full rounded border px-1.5 py-1 text-[11px] bg-transparent outline-none focus:border-indigo-600 focus:bg-white"
                        style={{ borderColor: "#EDEDED" }}
                      />
                    </td>

                    {/* Competência */}
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.competencia || ""}
                        placeholder="MM/AAAA"
                        onChange={(e) => handleFieldChange(item.id, "competencia", e.target.value)}
                        className="w-full rounded border px-1.5 py-1 text-[11px] bg-transparent outline-none focus:border-indigo-600 focus:bg-white font-mono"
                        style={{ borderColor: "#EDEDED" }}
                      />
                    </td>

                    {/* Empresa */}
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.empresa || ""}
                        onChange={(e) => handleFieldChange(item.id, "empresa", e.target.value)}
                        className="w-full rounded border px-1.5 py-1 text-[11px] font-medium bg-transparent outline-none focus:border-indigo-600 focus:bg-white"
                        style={{ borderColor: "#EDEDED" }}
                      />
                    </td>

                    {/* Descrição */}
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.descricao || ""}
                        onChange={(e) => handleFieldChange(item.id, "descricao", e.target.value)}
                        className="w-full rounded border px-1.5 py-1 text-[11px] bg-transparent outline-none focus:border-indigo-600 focus:bg-white"
                        style={{ borderColor: "#EDEDED" }}
                      />
                    </td>

                    {/* Categoria */}
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.categoria || ""}
                        onChange={(e) => handleFieldChange(item.id, "categoria", e.target.value)}
                        className="w-full rounded border px-1.5 py-1 text-[11px] bg-transparent outline-none focus:border-indigo-600 focus:bg-white"
                        style={{ borderColor: "#EDEDED" }}
                      />
                    </td>

                    {/* Área */}
                    <td className="px-3 py-2">
                      <select
                        value={item.area || ""}
                        onChange={(e) => handleFieldChange(item.id, "area", e.target.value || null)}
                        className="w-full rounded border px-1 py-1 text-[11px] bg-transparent outline-none focus:border-indigo-600 focus:bg-white"
                        style={{ borderColor: "#EDEDED" }}
                      >
                        <option value="">Selecione...</option>
                        {activeAreas.map((a) => (
                          <option key={a.id} value={a.nome}>
                            {a.nome}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Valor */}
                    <td className="px-3 py-2 font-mono">
                      <input
                        type="number"
                        step="0.01"
                        value={item.valor !== undefined ? item.valor : ""}
                        onChange={(e) =>
                          handleFieldChange(
                            item.id,
                            "valor",
                            e.target.value === "" ? 0 : parseFloat(e.target.value)
                          )
                        }
                        className="w-full rounded border px-1.5 py-1 text-[11px] bg-transparent outline-none focus:border-indigo-600 focus:bg-white"
                        style={{ borderColor: "#EDEDED" }}
                      />
                    </td>

                    {/* Pago */}
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(item.pago)}
                        onChange={(e) => handleFieldChange(item.id, "pago", e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>

                    {/* Forma de Pagamento */}
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.forma_pagamento || ""}
                        onChange={(e) => handleFieldChange(item.id, "forma_pagamento", e.target.value)}
                        className="w-full rounded border px-1.5 py-1 text-[11px] bg-transparent outline-none focus:border-indigo-600 focus:bg-white"
                        style={{ borderColor: "#EDEDED" }}
                      />
                    </td>

                    {/* Responsável */}
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.responsavel || ""}
                        onChange={(e) => handleFieldChange(item.id, "responsavel", e.target.value)}
                        className="w-full rounded border px-1.5 py-1 text-[11px] bg-transparent outline-none focus:border-indigo-600 focus:bg-white"
                        style={{ borderColor: "#EDEDED" }}
                      />
                    </td>

                    {/* Fixo/Variável */}
                    <td className="px-3 py-2">
                      <select
                        value={item.fixo_variavel || ""}
                        onChange={(e) => handleFieldChange(item.id, "fixo_variavel", e.target.value || null)}
                        className="w-full rounded border px-1 py-1 text-[11px] bg-transparent outline-none focus:border-indigo-600 focus:bg-white"
                        style={{ borderColor: "#EDEDED" }}
                      >
                        <option value="">Selecione...</option>
                        {FIXO_VARIAVEL_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Carnê Leão */}
                    <td className="px-3 py-2">
                      <select
                        value={item.carne_leao || ""}
                        onChange={(e) => handleFieldChange(item.id, "carne_leao", e.target.value || null)}
                        className="w-full rounded border px-1 py-1 text-[11px] bg-transparent outline-none focus:border-indigo-600 focus:bg-white"
                        style={{ borderColor: "#EDEDED" }}
                      >
                        <option value="">Selecione...</option>
                        {CARNE_LEAO_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Observação */}
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.observacao || ""}
                        onChange={(e) => handleFieldChange(item.id, "observacao", e.target.value)}
                        className="w-full rounded border px-1.5 py-1 text-[11px] bg-transparent outline-none focus:border-indigo-600 focus:bg-white"
                        style={{ borderColor: "#EDEDED" }}
                      />
                    </td>

                    {/* Divide */}
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.divide || ""}
                        onChange={(e) => handleFieldChange(item.id, "divide", e.target.value)}
                        className="w-full rounded border px-1.5 py-1 text-[11px] bg-transparent outline-none focus:border-indigo-600 focus:bg-white"
                        style={{ borderColor: "#EDEDED" }}
                      />
                    </td>

                    {/* Parcelas */}
                    <td className="px-3 py-2 text-center font-mono text-[11px]">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">
                        {item.parcela_atual}/{item.parcelas_totais}
                      </span>
                    </td>

                    {/* Valor Total */}
                    <td className="px-3 py-2 font-mono">
                      <input
                        type="number"
                        step="0.01"
                        value={item.valor_total !== undefined ? item.valor_total : ""}
                        onChange={(e) =>
                          handleFieldChange(
                            item.id,
                            "valor_total",
                            e.target.value === "" ? 0 : parseFloat(e.target.value)
                          )
                        }
                        className="w-full rounded border px-1.5 py-1 text-[11px] bg-transparent outline-none focus:border-indigo-600 focus:bg-white"
                        style={{ borderColor: "#EDEDED" }}
                      />
                    </td>

                    {/* Ações */}
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {activeTab === "pendente" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleValidarBatch([item.id])}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-white transition-colors"
                              style={{ backgroundColor: "#059669" }}
                              title="Validar e aprender padrão deste fornecedor"
                            >
                              <Check size={12} />
                              Validar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              className="inline-flex items-center rounded p-1 text-gray-400 hover:text-red-600 transition-colors"
                              title="Excluir lançamento"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleVoltarPendenteBatch([item.id])}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 transition-colors"
                            title="Voltar para pendentes"
                          >
                            <RotateCcw size={12} />
                            Voltar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Importar Lote (JSON) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div
            className="w-full max-w-3xl rounded-2xl border bg-white p-6 shadow-2xl space-y-4"
            style={{ borderColor: "#EDEDED" }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "#EDEDED" }}>
              <h3 className="text-lg font-bold" style={{ color: "#111111" }}>
                Importar lote de lançamentos (JSON)
              </h3>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-[13px] text-gray-600">
              Cole abaixo o array JSON contendo os lançamentos a importar. O sistema aplicará automaticamente sugestões de fornecedores conhecidos e dividirá parcelamentos acima de 1x.
            </p>

            <textarea
              rows={12}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder='[ { "data": "02/01/2026", "competencia": "01/2026", "empresa": "Fabiana da Silva Almeida", ... } ]'
              className="w-full rounded-xl border p-3 text-[12px] font-mono outline-none focus:border-indigo-600 bg-gray-50/50"
              style={{ borderColor: "#EDEDED" }}
            />

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setImportJsonText(sampleJsonText)}
                className="text-[11px] font-medium text-indigo-600 hover:underline"
              >
                Inserir modelo de exemplo
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="rounded-full border px-4 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-50"
                  style={{ borderColor: "#EDEDED" }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={handleImportJson}
                  className="rounded-full px-5 py-1.5 text-[12px] font-medium text-white transition-colors disabled:opacity-50"
                  style={{ backgroundColor: "#4F46E5" }}
                >
                  {isImporting ? "Processando..." : "Processar e Importar"}
                </button>
              </div>
            </div>

            {/* Error summary box */}
            {importResult && importResult.errorCount > 0 && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-red-900">
                  <AlertTriangle size={15} />
                  Resumo de itens com inconsistências ({importResult.errorCount}):
                </div>
                <ul className="max-h-40 overflow-y-auto space-y-1 text-[11px] text-red-800 list-disc pl-5">
                  {importResult.errors.map((errStr, i) => (
                    <li key={i}>{errStr}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Gerenciar Áreas */}
      {isAreasModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div
            className="w-full max-w-lg rounded-2xl border bg-white p-6 shadow-2xl space-y-4"
            style={{ borderColor: "#EDEDED" }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "#EDEDED" }}>
              <h3 className="text-lg font-bold" style={{ color: "#111111" }}>
                Gerenciar Áreas Financeiras
              </h3>
              <button
                type="button"
                onClick={() => setIsAreasModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Add new area */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Nome da nova área..."
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateArea()}
                className="flex-1 rounded-xl border px-3 py-1.5 text-[12px] outline-none focus:border-indigo-600"
                style={{ borderColor: "#EDEDED" }}
              />
              <button
                type="button"
                disabled={isCreatingArea || !newAreaName.trim()}
                onClick={handleCreateArea}
                className="inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-[12px] font-medium text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: "#4F46E5" }}
              >
                <Plus size={14} /> Adicionar
              </button>
            </div>

            {/* Areas List */}
            <div className="max-h-60 overflow-y-auto divide-y border rounded-xl" style={{ borderColor: "#EDEDED" }}>
              {areas.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 text-[12px]">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{a.nome}</span>
                    <span className="text-[10px] text-gray-400">Ord: {a.ordem}</span>
                    {a.ativo ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                        Ativo
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                        Inativo
                      </span>
                    )}
                  </div>

                  {a.ativo && (
                    <button
                      type="button"
                      onClick={() => handleDeactivateArea(a.id, a.nome)}
                      className="text-[11px] font-medium text-red-600 hover:underline"
                    >
                      Desativar
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsAreasModalOpen(false)}
                className="rounded-full border px-4 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-50"
                style={{ borderColor: "#EDEDED" }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Exportar Padrões Aprendidos */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-3xl rounded-2xl border bg-white p-6 shadow-xl space-y-4"
            style={{ borderColor: "#EDEDED" }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "#EDEDED" }}>
              <div>
                <h3 className="text-base font-bold text-gray-900">Padrões Aprendidos (Fornecedores Conhecidos)</h3>
                <p className="text-[12px] text-gray-500">
                  Tabela Markdown ordenada por fornecedor para backup, auditoria ou reutilização.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            {isLoadingExport ? (
              <div className="py-12 text-center text-[13px] text-gray-500">
                Carregando padrões aprendidos...
              </div>
            ) : (
              <div className="space-y-4">
                <textarea
                  readOnly
                  rows={12}
                  value={exportText}
                  className="w-full rounded-xl border p-3 font-mono text-[12px] bg-gray-50 text-gray-800 outline-none focus:ring-1 focus:ring-indigo-500"
                  style={{ borderColor: "#EDEDED" }}
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsExportModalOpen(false)}
                    className="rounded-full border px-4 py-1.5 text-[12px] font-medium text-gray-700 hover:bg-gray-50"
                    style={{ borderColor: "#EDEDED" }}
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyExportText}
                    disabled={exportText.startsWith("Nenhum padrão")}
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-medium text-white transition-colors disabled:opacity-50"
                    style={{ backgroundColor: "#4F46E5" }}
                  >
                    {isCopied ? (
                      <>
                        <Check size={14} /> Copiado ✓
                      </>
                    ) : (
                      <>
                        <Copy size={14} /> Copiar
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
