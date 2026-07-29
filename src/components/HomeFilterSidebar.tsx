import { Menu, X, type LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

export type FilterItem = {
  key: string;
  label: string;
  icon?: LucideIcon;
  active: boolean;
  onSelect: () => void;
  sub?: boolean;
};

type Props = {
  title: string;
  items: FilterItem[];
  children: ReactNode;
};

export function HomeFilterSidebarLayout({ title, items, children }: Props) {
  const [open, setOpen] = useState(false);

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
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              item.onSelect();
              onNav?.();
            }}
            className={`inline-flex items-center gap-2.5 rounded-full py-2 text-left font-medium transition-colors ${
              item.sub ? "ml-3 px-3 text-[12px]" : "px-3 text-[13px]"
            }`}
            style={
              item.active
                ? { backgroundColor: "#4F46E5", color: "#FFFFFF" }
                : { backgroundColor: "transparent", color: "#6B7280" }
            }
            onMouseEnter={(e) => {
              if (!item.active) e.currentTarget.style.backgroundColor = "#FAFAFA";
            }}
            onMouseLeave={(e) => {
              if (!item.active) e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            {Icon && <Icon className="h-4 w-4" />}
            <span>{item.label}</span>
          </button>
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
