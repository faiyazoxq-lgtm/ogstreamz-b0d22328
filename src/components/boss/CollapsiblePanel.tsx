import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

type Props = {
  id: string;
  title: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  tint: string;
  defaultOpen?: boolean;
  badge?: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

const KEY = (id: string) => `boss.panel.${id}.open`;

export function CollapsiblePanel({
  id, title, Icon, tint, defaultOpen = true, badge, subtitle, actions, children, className,
}: Props) {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY(id));
      if (raw !== null) setOpen(raw === "1");
    } catch { /* ignore */ }
    setHydrated(true);
  }, [id]);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(KEY(id), open ? "1" : "0"); } catch { /* ignore */ }
  }, [open, id, hydrated]);

  const panelId = `panel-${id}`;

  return (
    <section
      className={`glass-obsidian-cmd rounded-2xl border transition-all ${className ?? ""}`}
      style={{ borderColor: `${tint}40` }}
      id={id}
    >
      <header className="flex items-center gap-3 px-4 py-3 md:px-5 md:py-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-md focus-visible:ring-2 focus-visible:ring-gold/60 outline-none"
        >
          <span
            className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${tint}1f`, border: `1px solid ${tint}55` }}
          >
            <Icon className="h-4 w-4" style={{ color: tint }} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="syndicate-header text-sm md:text-base text-white/95 truncate">{title}</h2>
              {badge}
            </div>
            {subtitle && (
              <p className="text-[11px] text-white/45 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          <ChevronDown
            className={`h-4 w-4 text-white/55 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
          />
        </button>
        {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
      </header>
      <div
        id={panelId}
        hidden={!open}
        className={open ? "px-4 pb-4 md:px-5 md:pb-5 animate-fade-in" : ""}
      >
        {open && children}
      </div>
    </section>
  );
}