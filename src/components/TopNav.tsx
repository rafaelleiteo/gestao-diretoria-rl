import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useMemo } from "react";
import { TAB_AREAS } from "@/lib/areas";
import { lockSite } from "@/lib/gate.functions";
import { getCurrentUser, listUsers, inviteUser, deleteUser, deleteInvite } from "@/lib/auth.functions";
import { getPermissions, savePermissions, getMyPermissions } from "@/lib/permissions.functions";
import { Users, X, Copy, Trash2, Plus, ShieldCheck, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";



export function TopNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const lock = useServerFn(lockSite);

  const [user, setUser] = useState<any>(null);
  const [myPermissions, setMyPermissions] = useState<any[]>([]);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [userPermissions, setUserPermissions] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);


  const fetchCurrentUser = useServerFn(getCurrentUser);
  const fetchMyPermissions = useServerFn(getMyPermissions);
  const fetchUsers = useServerFn(listUsers);
  const fetchUserPermissions = useServerFn(getPermissions);
  const saveUserPermissions = useServerFn(savePermissions);
  const invite = useServerFn(inviteUser);
  const remove = useServerFn(deleteUser);
  const removeInvite = useServerFn(deleteInvite);

  useEffect(() => {
    let active = true;

    async function loadAccess() {
      const [profileResult, permissionsResult] = await Promise.allSettled([
        fetchCurrentUser(),
        fetchMyPermissions(),
      ]);

      if (!active) return;

      if (profileResult.status === "fulfilled") {
        const profile = profileResult.value;
        console.info("[auth-debug] perfil atual", profile
          ? { id: profile.id, role: profile.role, status: profile.status }
          : null);
        setUser(profile);
      } else {
        console.error("Falha ao carregar o perfil atual", profileResult.reason);
        toast.error("Não foi possível carregar seu perfil");
      }

      if (permissionsResult.status === "fulfilled") {
        setMyPermissions(permissionsResult.value);
      } else {
        console.error("Falha ao carregar permissões", permissionsResult.reason);
      }

      setIsLoadingUser(false);
    }

    void loadAccess();
    return () => {
      active = false;
    };
  }, [fetchCurrentUser, fetchMyPermissions]);

  useEffect(() => {
    if (showUsersModal) {
      fetchUsers().then(setUsers);
    }
  }, [showUsersModal, fetchUsers]);

  const canAccessArea = (areaSlug: string) => {
    if (isLoadingUser) return false;
    if (!user) return false;
    if (user.role === "admin") return true;
    return myPermissions.some(p => p.area === areaSlug);
  };


  async function onLogout() {
    await supabase.auth.signOut();
    await lock();
    await router.invalidate();
    await router.navigate({ to: "/unlock" });
  }

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { token } = await invite({ data: { nome: newUserName, email: newUserEmail } });
      const inviteLink = `${window.location.origin}/convite/${token}`;
      
      // We'll show the link in a toast or just update the list
      toast.success("Usuário convidado!");
      setNewUserName("");
      setNewUserEmail("");
      setShowAddForm(false);
      fetchUsers().then(setUsers);
      
      // Copy to clipboard immediately
      await navigator.clipboard.writeText(inviteLink);
      toast.info("Link de convite copiado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao convidar");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDeleteUser(u: any) {
    const isConvite = !!u.isConvite;
    if (!confirm(isConvite ? "Cancelar este convite?" : "Tem certeza que deseja remover este acesso?")) return;
    try {
      if (isConvite) {
        await removeInvite({ data: u.id });
        toast.success("Convite cancelado");
      } else {
        await remove({ data: u.id });
        toast.success("Usuário removido");
      }
      fetchUsers().then(setUsers);
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover");
    }
  }



  async function onOpenPermissions(u: any) {
    setSelectedUser(u);
    try {
      const perms = await fetchUserPermissions({ data: u.id });
      setUserPermissions(perms);
      setShowPermissionsModal(true);
    } catch (err: any) {
      toast.error("Erro ao carregar permissões");
    }
  }

  async function onTogglePermission(area: string, item: string) {
    const exists = userPermissions.some(p => p.area === area && p.item_menu === item);
    let next: any[];
    
    if (exists) {
      next = userPermissions.filter(p => !(p.area === area && p.item_menu === item));
    } else {
      next = [...userPermissions, { area, item_menu: item }];
    }
    
    // If setting specific item, ensure "*" is removed
    if (item !== "*" && !exists) {
      next = next.filter(p => !(p.area === area && p.item_menu === "*"));
    }
    // If setting "*", remove all other items for that area
    if (item === "*" && !exists) {
      next = next.filter(p => p.area !== area || p.item_menu === "*");
    }
    
    setUserPermissions(next);
  }

  async function onSavePermissions() {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      await saveUserPermissions({ 
        data: { 
          userId: selectedUser.id, 
          permissions: userPermissions.map(p => ({ area: p.area, item_menu: p.item_menu }))
        } 
      });
      toast.success("Permissões salvas com sucesso");
      setShowPermissionsModal(false);
    } catch (err: any) {
      toast.error("Erro ao salvar permissões");
    } finally {
      setSubmitting(false);
    }
  }

  // Map of areas and their items (mocked/extracted from route structure logic)
  const AREA_MENU_ITEMS: Record<string, { label: string, key: string }[]> = {
    diretoria: [{ label: "Visão Geral", key: "index" }],
    financeiro: [
      { label: "Visão Geral", key: "index" },
      { label: "Pagamentos Recorrentes", key: "pagamentos-recorrentes" },
      { label: "Links", key: "links" }
    ],
    consultorio: [
      { label: "Visão Geral", key: "index" },
      { label: "Ficha de Planejamento", key: "ficha-planejamento" },
      { label: "Modelos de Documentos", key: "modelos-documentos" },
      { label: "Protocolos", key: "protocolos" },
      { label: "Links", key: "links" }
    ],
    gestao: [
      { label: "Prompts", key: "prompts" },
      { label: "Tarefas Recorrentes", key: "tarefas-recorrentes" },
      { label: "Recorrentes Mensal", key: "tarefas-recorrentes-mensal" },
      { label: "Rotina", key: "rotina" },
      { label: "Links", key: "links" }
    ],
    versa3d: [{ label: "Visão Geral", key: "index" }, { label: "Links", key: "links" }],
    especializacao: [{ label: "Visão Geral", key: "index" }, { label: "Links", key: "links" }],
    graduacao: [{ label: "Visão Geral", key: "index" }, { label: "Links", key: "links" }],
    doutorado: [{ label: "Visão Geral", key: "index" }, { label: "Links", key: "links" }],
    "dentistas-petropolis": [{ label: "Visão Geral", key: "index" }, { label: "Links", key: "links" }],
    "connect-lab": [{ label: "Visão Geral", key: "index" }, { label: "Links", key: "links" }],
  };

  return (
    <header
      className="sticky top-0 z-30 w-full border-b bg-white"
      style={{ borderColor: "#EDEDED" }}
    >
      <div className="flex items-center gap-6 overflow-x-auto px-8 py-3">
        <Link
          to="/"
          className="shrink-0 text-[17px] font-bold tracking-tight"
          style={{ color: "#111111", letterSpacing: "-0.02em" }}
        >
          Rafael Leite
        </Link>

        <nav className="flex items-center gap-1.5">
          {TAB_AREAS.filter(area => canAccessArea(area.slug)).map((area) => {
            const to = `/${area.slug}`;
            const active = pathname === to || pathname.startsWith(to + "/");
            return (
              <Link
                key={area.slug}
                to={to}
                className="group inline-flex shrink-0 items-center gap-2 rounded-[20px] px-4 py-1.5 text-[13px] font-medium transition-colors"
                style={
                  active
                    ? { backgroundColor: "#4F46E5", color: "#FFFFFF" }
                    : { backgroundColor: "transparent", color: "#6B7280" }
                }
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.backgroundColor = "#FAFAFA";
                }}
                onMouseLeave={(e) => {
                  if (!active)
                    e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span className="whitespace-nowrap">{area.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {user?.role === "admin" && (
            <button
              type="button"
              onClick={() => setShowUsersModal(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full border transition-colors hover:bg-[#FAFAFA]"
              style={{ borderColor: "#EDEDED", color: "#6B7280" }}
              title="Gerenciar usuários"
            >
              <Users size={16} />
            </button>
          )}

          <button
            type="button"
            onClick={onLogout}
            className="shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-[#FAFAFA]"
            style={{ borderColor: "#EDEDED", color: "#6B7280" }}
          >
            Sair
          </button>
        </div>
      </div>

      {showUsersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm px-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border bg-white shadow-xl" style={{ borderColor: "#EDEDED" }}>
            <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: "#EDEDED" }}>
              <h2 className="text-lg font-bold tracking-tight" style={{ color: "#111111" }}>Gerenciar Usuários</h2>
              <button 
                onClick={() => {
                  setShowUsersModal(false);
                  setShowAddForm(false);
                }}
                className="text-[#6B7280] hover:text-[#111111]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-[13px] font-semibold uppercase tracking-wider text-[#6B7280]">Usuários ({users.length})</h3>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[12px] font-semibold text-white transition-opacity"
                  style={{ backgroundColor: "#4F46E5" }}
                >
                  <Plus size={14} />
                  Adicionar usuário
                </button>
              </div>

              {showAddForm && (
                <form onSubmit={onInvite} className="mb-8 rounded-xl border bg-[#FAFAFA] p-4" style={{ borderColor: "#EDEDED" }}>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium uppercase text-[#6B7280]">Nome</label>
                      <input
                        type="text"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        required
                        className="h-9 rounded-lg border bg-white px-3 text-[13px] outline-none focus:border-[#4F46E5]"
                        style={{ borderColor: "#EDEDED" }}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium uppercase text-[#6B7280]">E-mail</label>
                      <input
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        required
                        className="h-9 rounded-lg border bg-white px-3 text-[13px] outline-none focus:border-[#4F46E5]"
                        style={{ borderColor: "#EDEDED" }}
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="rounded-full px-4 py-1.5 text-[12px] font-medium text-[#6B7280]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="rounded-full px-4 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                      style={{ backgroundColor: "#4F46E5" }}
                    >
                      {submitting ? "Salvando..." : "Salvar e Gerar Link"}
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {users.map((u) => (
                  <div 
                    key={u.id} 
                    className="flex items-center justify-between rounded-xl border p-4 transition-colors hover:bg-[#FAFAFA]"
                    style={{ borderColor: "#EDEDED" }}
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold text-[#111111]">{u.nome}</span>
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" 
                          style={u.role === "admin" ? { backgroundColor: "#EEF2FF", color: "#4F46E5" } : { backgroundColor: "#F3F4F6", color: "#6B7280" }}
                        >
                          {u.role}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                          style={u.status === "ativo"
                            ? { backgroundColor: "#ECFDF5", color: "#047857" }
                            : { backgroundColor: "#FFFBEB", color: "#B45309" }}
                        >
                          {u.status === "ativo" ? "Ativo" : "Convite pendente"}
                        </span>
                      </div>
                      <span className="text-[12px] text-[#6B7280]">{u.email}</span>
                    </div>


                    <div className="flex items-center gap-2">
                      {u.convite_token && u.status !== "ativo" && (
                        <button
                          onClick={() => {
                            const link = `${window.location.origin}/convite/${u.convite_token}`;
                            navigator.clipboard.writeText(link);
                            toast.success("Link copiado!");
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full border text-[#6B7280] hover:bg-white"
                          style={{ borderColor: "#EDEDED" }}
                          title="Copiar link de convite"
                        >
                          <Copy size={14} />
                        </button>
                      )}
                      
                      {u.id !== user?.id && (
                        <>
                          {u.role === "colaborador" && !u.isConvite && (
                            <button
                              onClick={() => onOpenPermissions(u)}
                              className="flex h-8 w-8 items-center justify-center rounded-full border text-[#6B7280] hover:bg-white"
                              style={{ borderColor: "#EDEDED" }}
                              title="Permissões"
                            >
                              <ShieldCheck size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => onDeleteUser(u)}
                            className="flex h-8 w-8 items-center justify-center rounded-full border text-[#B45309] hover:bg-white"
                            style={{ borderColor: "#EDEDED" }}
                            title="Remover usuário"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </header>
  );
}
