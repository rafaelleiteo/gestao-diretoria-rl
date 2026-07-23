import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { TAB_AREAS } from "@/lib/areas";
import { lockSite } from "@/lib/gate.functions";

export function TopNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const lock = useServerFn(lockSite);

  async function onLogout() {
    await lock();
    await router.invalidate();
    await router.navigate({ to: "/unlock" });
  }

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
          {TAB_AREAS.map((area) => {
            const to = `/${area.slug}`;
            const active = pathname === to;
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

        <button
          type="button"
          onClick={onLogout}
          className="ml-auto shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors"
          style={{ borderColor: "#EDEDED", color: "#6B7280" }}
        >
          Sair
        </button>
      </div>
    </header>
  );
}
