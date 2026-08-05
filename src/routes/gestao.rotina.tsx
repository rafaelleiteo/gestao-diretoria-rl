import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getRotinaCards, 
  saveRotinaCard, 
  deleteRotinaCard, 
  batchUpdateRotinaCards, 
  restoreDefaultRotina 
} from "@/lib/rotina.functions";
import { ROTINA_DEFAULTS, RotinaTab } from "@/lib/rotina-defaults";
import { TAB_AREAS, areaLabel, AreaValue } from "@/lib/areas";
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  X, 
  Download, 
  RotateCcw,
  CalendarDays
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/gestao/rotina")({
  component: RotinaPage,
});

const TABS: { id: RotinaTab; label: string }[] = [
  { id: 'distribuir', label: 'Distribuir' },
  { id: 'descarga', label: 'Descarga' },
  { id: 'rotina_padrao', label: 'Rotina Padrão' },
  { id: 'semana_1', label: 'Semana 1' },
  { id: 'semana_2', label: 'Semana 2' },
  { id: 'semana_3', label: 'Semana 3' },
  { id: 'semana_4', label: 'Semana 4' },
];

const DIAS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

function RotinaPage() {
  const [activeTab, setActiveTab] = useState<RotinaTab>('rotina_padrao');
  const [viewByDay, setViewByDay] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportText, setExportText] = useState("");

  const queryClient = useQueryClient();

  const { data: cards = [] } = useQuery({
    queryKey: ['rotina_cards'],
    queryFn: async () => {
      const data = await getRotinaCards();
      if (data && data.length === 0) {
        await restoreDefaultRotina({ cards: ROTINA_DEFAULTS as any[] });
        return getRotinaCards();
      }
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => saveRotinaCard({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rotina_cards'] });
      toast.success("Card salvo");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRotinaCard({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rotina_cards'] });
      toast.success("Card removido");
    }
  });

  const batchMutation = useMutation({
    mutationFn: (data: any[]) => batchUpdateRotinaCards({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rotina_cards'] });
    }
  });

  const restoreMutation = useMutation({
    mutationFn: (payload: any) => restoreDefaultRotina({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rotina_cards'] });
      toast.success("Conteúdo restaurado para o padrão");
    }
  });

  const handleToggleConcluido = (card: any) => {
    const { id, criado_em, ...rest } = card;
    saveMutation.mutate({ ...rest, id, concluido: !card.concluido });
  };

  const handleAddCard = (tab: RotinaTab, coluna: string, text: string, area: AreaValue | null, isDivisor: boolean = false) => {
    const colCards = (cards || []).filter((c: any) => c.tab === tab && c.coluna === coluna);
    const maxOrder = colCards.length > 0 ? Math.max(...colCards.map((c: any) => c.ordem)) : 0;
    
    saveMutation.mutate({
      tab,
      coluna,
      area: area as any,
      tipo_linha: isDivisor ? 'divisor' : 'card',
      texto: text,
      concluido: false,
      ordem: maxOrder + 1
    });
  };

  const handleRestore = () => {
    if (!confirm("Tem certeza que deseja restaurar esta aba/dia para o conteúdo padrão? Todas as customizações locais serão perdidas.")) return;
    
    let defaultCards: any[] = [];
    if (viewByDay) {
      const dayWeeks: RotinaTab[] = ['semana_1', 'semana_2', 'semana_3', 'semana_4'];
      defaultCards = ROTINA_DEFAULTS.filter(c => dayWeeks.includes(c.tab) && c.coluna === viewByDay);
      restoreMutation.mutate({ dia: viewByDay, cards: defaultCards });
    } else {
      defaultCards = ROTINA_DEFAULTS.filter(c => c.tab === activeTab);
      restoreMutation.mutate({ tab: activeTab, cards: defaultCards });
    }
  };

  const handleExport = () => {
    let text = "ROTINA - EXPORTAÇÃO\n\n";
    TABS.forEach(t => {
      text += `--- ${t.label.toUpperCase()} ---\n`;
      const tabCards = (cards || []).filter((c: any) => c.tab === t.id);
      
      let cols: string[] = [];
      if (t.id === 'distribuir') cols = ['distribuir', 'ideias', 'desejos'];
      else if (t.id === 'descarga') cols = ['descarga'];
      else cols = DIAS;

      cols.forEach(col => {
        const colCards = tabCards.filter(c => c.coluna === col).sort((a, b) => a.ordem - b.ordem);
        if (colCards.length === 0) return;
        
        text += `\n[${col.toUpperCase()}]\n`;
        colCards.forEach(c => {
          if (c.tipo_linha === 'divisor') {
            text += `\n--- ${c.texto} ---\n`;
          } else {
            const status = c.concluido ? "[X]" : "[ ]";
            const areaName = c.area ? `(${areaLabel(c.area as any)})` : "";
            text += `${status} ${c.texto} ${areaName}\n`;
          }
        });
      });
      text += "\n";
    });

    setExportText(text);
    setIsExportModalOpen(true);
  };

  const renderColumn = (tab: RotinaTab, coluna: string, label: string) => {
    const colCards = (cards || [])
      .filter((c: any) => c.tab === tab && c.coluna === coluna)
      .sort((a, b) => a.ordem - b.ordem);

    return (
      <div key={`${tab}-${coluna}`} className="flex flex-col gap-4 min-w-[250px] flex-1">
        <div className="flex items-center justify-between border-b border-border pb-2 mb-2">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">{label}</h3>
          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{colCards.filter((c: any) => c.tipo_linha === 'card').length}</span>
        </div>

        <div className="flex flex-col gap-2 min-h-[100px]">
          {colCards.map((card: any) => (
            <RotinaCard 
              key={card.id} 
              card={card} 
              onToggle={() => handleToggleConcluido(card)}
              onDelete={() => deleteMutation.mutate(card.id)}
            />
          ))}
          <AddCardForm onAdd={(text, area) => handleAddCard(tab, coluna, text, area)} />
        </div>
      </div>
    );
  };

  const currentCols = useMemo(() => {
    if (activeTab === 'distribuir') return ['distribuir', 'ideias', 'desejos'];
    if (activeTab === 'descarga') return ['descarga'];
    return DIAS;
  }, [activeTab]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rotina</h1>
          <p className="text-muted-foreground text-sm">Organize suas semanas e processos diários.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={handleRestore} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
            <RotateCcw className="h-4 w-4 mr-2" />
            Restaurar padrão
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-48 flex-shrink-0 flex flex-col gap-2">
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Ver por dia</h4>
          <div className="flex flex-wrap lg:flex-col gap-1">
            {DIAS.map(dia => (
              <button
                key={dia}
                onClick={() => setViewByDay(viewByDay === dia ? null : dia)}
                className={cn(
                  "px-3 py-2 text-sm text-left rounded-md transition-colors capitalize",
                  viewByDay === dia 
                    ? "bg-indigo-600 text-white" 
                    : "hover:bg-muted text-muted-foreground"
                )}
              >
                {dia}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-6 min-w-0">
          {!viewByDay && (
            <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-none">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium whitespace-nowrap rounded-full transition-all border",
                    activeTab === tab.id
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-white text-muted-foreground border-border hover:border-indigo-200"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {viewByDay ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground border-b pb-4">
                <CalendarDays className="h-4 w-4" />
                <span>Visualização Comparativa: <strong className="capitalize text-foreground">{viewByDay}</strong></span>
                <button 
                  onClick={() => setViewByDay(null)}
                  className="ml-auto text-indigo-600 hover:underline font-medium"
                >
                  Voltar para abas
                </button>
              </div>
              <div className="flex overflow-x-auto gap-8 pb-4">
                {['semana_1', 'semana_2', 'semana_3', 'semana_4'].map(week => (
                  renderColumn(week as RotinaTab, viewByDay, `Semana ${week.split('_')[1]}`)
                ))}
              </div>
            </div>
          ) : (
            <div className="flex overflow-x-auto gap-8 pb-4">
              {currentCols.map(col => renderColumn(activeTab, col, col === activeTab ? col : col))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Exportar Rotina</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <textarea
              readOnly
              value={exportText}
              className="w-full h-96 p-4 font-mono text-sm bg-muted rounded-md border resize-none focus:outline-none"
            />
            <Button className="w-full" onClick={() => {
              navigator.clipboard.writeText(exportText);
              toast.success("Copiado para a área de transferência");
            }}>
              Copiar conteúdo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RotinaCard({ card, onToggle, onDelete }: { card: any, onToggle: () => void, onDelete: () => void }) {
  if (card.tipo_linha === 'divisor') {
    return (
      <div className="group relative py-2 flex items-center justify-center">
        <div className="h-px bg-border flex-1"></div>
        <span className="px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap">
          {card.texto}
        </span>
        <div className="h-px bg-border flex-1"></div>
        <button 
          onClick={onDelete}
          className="absolute right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  const getAreaColor = (area: string | null) => {
    if (!area) return "bg-gray-100 text-gray-600";
    const colors: Record<string, string> = {
      'diretoria': 'bg-indigo-100 text-indigo-700',
      'financeiro': 'bg-emerald-100 text-emerald-700',
      'consultorio': 'bg-blue-100 text-blue-700',
      'gestao': 'bg-purple-100 text-purple-700',
      'versa3d': 'bg-orange-100 text-orange-700',
      'especializacao': 'bg-rose-100 text-rose-700',
      'graduacao': 'bg-amber-100 text-amber-700',
      'doutorado': 'bg-cyan-100 text-cyan-700',
      'dentistas-petropolis': 'bg-lime-100 text-lime-700',
      'connect-lab': 'bg-violet-100 text-violet-700',
    };
    return colors[area] || "bg-gray-100 text-gray-600";
  };

  return (
    <div className="group relative bg-white border border-[#EDEDED] p-3 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:border-indigo-200 transition-all">
      <div className="flex gap-3">
        {card.tab !== 'distribuir' && (
          <button 
            onClick={onToggle}
            className={cn(
              "mt-0.5 flex-shrink-0 transition-colors",
              card.concluido ? "text-indigo-600" : "text-muted-foreground hover:text-indigo-400"
            )}
          >
            {card.concluido ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
          </button>
        )}
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-sm font-medium leading-tight mb-2",
            card.concluido && "line-through text-muted-foreground"
          )}>
            {card.texto}
          </p>
          {card.area && (
            <span className={cn(
              "inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider",
              getAreaColor(card.area)
            )}>
              {areaLabel(card.area as any)}
            </span>
          )}
        </div>
        <button 
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive self-start"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function AddCardForm({ onAdd }: { onAdd: (text: string, area: AreaValue | null) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [area, setArea] = useState<AreaValue | "none">("none");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd(text, area === "none" ? null : area);
    setText("");
    setArea("none");
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="w-full py-2 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50/50 rounded-md transition-all border border-dashed border-border hover:border-indigo-200 mt-2"
      >
        <Plus className="h-3 w-3" />
        Adicionar
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-muted/30 p-3 rounded-lg border border-border space-y-3 mt-2">
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Texto do card..."
        className="w-full bg-white border border-border rounded-md p-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[60px] resize-none"
      />
      <div className="flex items-center gap-2">
        <Select value={area} onValueChange={(val: any) => setArea(val)}>
          <SelectTrigger className="h-8 text-[10px] uppercase font-bold tracking-wider">
            <SelectValue placeholder="ÁREA" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">SEM ÁREA</SelectItem>
            {TAB_AREAS.map(a => (
              <SelectItem key={a.slug} value={a.slug} className="uppercase text-[10px] font-bold">
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="flex-1 h-8 text-xs bg-indigo-600 hover:bg-indigo-700">Adicionar</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setIsOpen(false)} className="h-8 text-xs">Cancelar</Button>
      </div>
    </form>
  );
}
