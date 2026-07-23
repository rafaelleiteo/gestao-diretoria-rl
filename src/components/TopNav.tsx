import { Link, useRouterState } from "@tanstack/react-router";
import { TAB_AREAS } from "@/lib/areas";

export function TopNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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
                {area.phase1 && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                    style={
                      active
                        ? {
                            backgroundColor: "rgba(255,255,255,0.22)",
                            color: "#FFFFFF",
                          }
                        : { backgroundColor: "#EEF0FF", color: "#4F46E5" }
                    }
                  >
                    Fase 1
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
