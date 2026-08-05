import { Link, useRouterState, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Menu, X, type LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode, useMemo } from "react";
import { getCurrentUser } from "@/lib/auth.functions";
import { getMyPermissions } from "@/lib/permissions.functions";
import { toast } from "sonner";


export type SidebarMenuItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

type Props = {
  title: string;
  menu: SidebarMenuItem[];
  children: ReactNode;
};

export function AreaSidebarLayout({ title, menu, children }: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [myPermissions, setMyPermissions] = useState<any[]>([]);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  const fetchCurrentUser = useServerFn(getCurrentUser);
  const fetchMyPermissions = useServerFn(getMyPermissions);

  useEffect(() => {
    Promise.all([
      fetchCurrentUser().then(setUser),
      fetchMyPermissions().then(setMyPermissions)
    ]).finally(() => setIsLoadingUser(false));
  }, [fetchCurrentUser, fetchMyPermissions]);

  const slugFromTitle = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
  
  const filteredMenu = useMemo(() => {
    if (isLoadingUser) return [];
    if (!user) return [];
    if (user.role === "admin") return menu;

    const areaPerms = myPermissions.filter(p => p.area === slugFromTitle);
    const hasAreaFull = areaPerms.some(p => p.item_menu === "*");

    if (hasAreaFull) return menu;

    return menu.filter(item => {
      const itemKey = item.to.split("/").pop() || "index";
      return areaPerms.some(p => p.item_menu === itemKey);
    });
  }, [user, myPermissions, menu, slugFromTitle]);

  // Authorization check
  useEffect(() => {
    if (!isLoadingUser && user && user.role !== "admin") {
      const areaPerms = myPermissions.filter(p => p.area === slugFromTitle);
      const hasAccess = areaPerms.length > 0;
      
      if (!hasAccess) {
        toast.error("Você não tem acesso a esta área");
        router.navigate({ to: "/" });
        return;
      }

      // Check specific item if not index
      const itemKey = pathname.split("/").pop() || "index";
      if (itemKey !== slugFromTitle && !areaPerms.some(p => p.item_menu === "*" || p.item_menu === itemKey)) {
        toast.error("Você não tem acesso a esta ferramenta");
        router.navigate({ to: `/${slugFromTitle}` });
      }
    }
  }, [user, myPermissions, pathname, router, slugFromTitle]);


  // Close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const renderNav = (onNav?: () => void) => (
    <nav className="flex flex-col gap-0.5">
      {filteredMenu.map((item) => {
        const active = item.exact
          ? pathname === item.to
          : pathname === item.to || pathname.startsWith(item.to + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNav}
            className="inline-flex items-center gap-2.5 rounded-full px-3 py-2 text-[13px] font-medium transition-colors"
            style={
              active
                ? { backgroundColor: "#4F46E5", color: "#FFFFFF" }
                : { backgroundColor: "transparent", color: "#6B7280" }
            }
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.backgroundColor = "#FAFAFA";
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const sectionLabel = (
    <div
      className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider"
      style={{ color: "#4F46E5", letterSpacing: "0.08em" }}
    >
      {title}
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1400px] gap-8 px-6 py-8">
      <aside
        className="sticky top-[73px] hidden h-[calc(100vh-97px)] w-[240px] shrink-0 rounded-2xl border bg-white p-3 md:block"
        style={{ borderColor: "#EDEDED" }}
      >
        {sectionLabel}
        {renderNav()}
      </aside>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mb-4 inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-[12px] font-medium md:hidden"
          style={{ borderColor: "#EDEDED", color: "#6B7280" }}
          aria-label={`Abrir menu ${title}`}
        >
          <Menu className="h-4 w-4" />
          <span>{title}</span>
        </button>

        {children}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div
            className="absolute left-0 top-0 h-full w-[260px] border-r bg-white p-3 shadow-xl"
            style={{ borderColor: "#EDEDED" }}
          >
            <div className="flex items-center justify-between">
              {sectionLabel}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mr-1 rounded-full p-1.5"
                style={{ color: "#6B7280" }}
                aria-label="Fechar menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {renderNav(() => setOpen(false))}
          </div>
        </div>
      )}
    </div>
  );
}
