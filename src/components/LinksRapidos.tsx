import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Plus, X, ExternalLink, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { getLinks, addLink, removeLink } from "@/lib/links.functions";
import { type AreaValue } from "@/lib/areas";

type Props = {
  area: AreaValue;
};

export function LinksRapidos({ area }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const qc = useQueryClient();
  
  const { data: links, isLoading } = useQuery({
    queryKey: ["links_rapidos", area],
    queryFn: () => getLinks({ data: { area } }),
  });

  const createMutation = useMutation({
    mutationFn: (data: { titulo: string; url: string }) => 
      addLink({ data: { area, ...data } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["links_rapidos", area] });
      setTitulo("");
      setUrl("");
      setIsAdding(false);
      toast.success("Link adicionado!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao adicionar link");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeLink({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["links_rapidos", area] });
      toast.success("Link removido");
    }
  });

  const handleCopy = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRemove = (id: string) => {
    if (confirm("Deseja remover este link?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.startsWith("http")) {
      toast.error("URL deve começar com http:// ou https://");
      return;
    }
    createMutation.mutate({ titulo, url });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: "#111111" }}>Links Rápidos</h2>
          <p className="text-[13px]" style={{ color: "#6B7280" }}>Atalhos úteis para esta área.</p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="inline-flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#4F46E5" }}
        >
          {isAdding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {isAdding ? "Cancelar" : "Adicionar link"}
        </button>
      </div>

      {isAdding && (
        <form 
          onSubmit={handleAdd}
          className="space-y-4 rounded-2xl border bg-white p-5"
          style={{ borderColor: "#EDEDED" }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold uppercase tracking-wider text-[#6B7280]">
                Título
              </label>
              <input
                required
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Sistema X"
                className="w-full rounded-xl border px-3 py-2 text-[14px] outline-none transition-colors focus:border-[#4F46E5]"
                style={{ borderColor: "#EDEDED" }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold uppercase tracking-wider text-[#6B7280]">
                URL
              </label>
              <input
                required
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://exemplo.com"
                className="w-full rounded-xl border px-3 py-2 text-[14px] outline-none transition-colors focus:border-[#4F46E5]"
                style={{ borderColor: "#EDEDED" }}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full rounded-xl py-2 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 md:w-auto md:px-6"
            style={{ backgroundColor: "#4F46E5" }}
          >
            {createMutation.isPending ? "Salvando..." : "Salvar Link"}
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="py-10 text-center text-[13px]" style={{ color: "#6B7280" }}>Carregando...</div>
      ) : links && links.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((link: any) => (
            <div
              key={link.id}
              className="group relative flex flex-col gap-3 rounded-2xl border bg-white p-4 transition-all hover:shadow-sm"
              style={{ borderColor: "#EDEDED" }}
            >
              <button
                onClick={() => handleRemove(link.id)}
                className="absolute right-2 top-2 rounded-full p-1 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                style={{ color: "#9CA3AF" }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
              
              <div className="flex items-center gap-2 pr-6">
                <Link2 className="h-4 w-4 shrink-0" style={{ color: "#4F46E5" }} />
                <span className="truncate font-semibold text-[14px]" style={{ color: "#111111" }}>
                  {link.titulo}
                </span>
              </div>
              
              <div className="mt-auto flex gap-2">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[12px] font-medium transition-colors hover:bg-gray-50"
                  style={{ borderColor: "#EDEDED", color: "#4F46E5" }}
                >
                  <ExternalLink className="h-3 w-3" />
                  Abrir link
                </a>
                <button
                  onClick={() => handleCopy(link.id, link.url)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[12px] font-medium transition-colors hover:bg-gray-50"
                  style={{ borderColor: "#EDEDED", color: "#6B7280" }}
                >
                  {copiedId === link.id ? (
                    <>
                      <Check className="h-3 w-3" style={{ color: "#10B981" }} />
                      Copiado ✓
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copiar
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div 
          className="rounded-2xl border border-dashed py-12 text-center"
          style={{ borderColor: "#EDEDED" }}
        >
          <p className="text-[13px]" style={{ color: "#9CA3AF" }}>
            Nenhum link cadastrado nesta área.
          </p>
        </div>
      )}
    </div>
  );
}
