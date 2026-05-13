import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Crown } from "lucide-react";

export type RailItem = {
  to: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  desc?: string;
};

export type RailGroup = {
  id: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  tint: string;
  items: RailItem[];
};

type Props = {
  top: RailItem;
  groups: RailGroup[];
  alertsUnread: number;
  alertsTo: string;
};

export function BossCommandRail({ top, groups, alertsUnread, alertsTo }: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (n: RailItem) =>
    n.exact ? pathname === n.to : pathname === n.to || pathname.startsWith(n.to + "/");

  const activeGroupId = useMemo(() => {
    const g = groups.find((g) => g.items.some(isActive));
    return g?.id ?? groups[0]?.id ?? "";
  }, [pathname, groups]);

  const [openId, setOpenId] = useState(activeGroupId);
  useEffect(() => { setOpenId(activeGroupId); }, [activeGroupId]);

  const activeGroup = groups.find((g) => g.id === openId) ?? groups[0];

  return (
    <nav
      aria-label="Boss command rail"
      className="sticky top-[7.5rem] md:top-[6.75rem] z-20 -mx-3 sm:-mx-6 mb-4 backdrop-blur-xl bg-background/85 border-b border-gold/15 shadow-[0_8px_20px_-22px_rgba(255,209,102,0.6)]"
    >
      {/* Row 1: Categories */}
      <ScrollRow className="px-3 sm:px-6 pt-2">
        <Link
          to={top.to}
          className={pillClass(isActive(top), "#ffd166")}
          aria-current={isActive(top) ? "page" : undefined}
        >
          <Crown className="h-3.5 w-3.5" />
          <span className="font-extrabold tracking-tight">{top.label}</span>
        </Link>
        <span className="mx-1 h-5 w-px bg-white/10 shrink-0" aria-hidden />
        {groups.map((g) => {
          const active = activeGroupId === g.id;
          const opened = openId === g.id;
          const showAlert = g.id === "command" && alertsUnread > 0;
          const tintColor = g.tint;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setOpenId(opened ? "" : g.id)}
              aria-expanded={opened}
              aria-current={active ? "page" : undefined}
              className={[
                "relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] transition-all duration-200 shrink-0 active:scale-[0.97]",
                opened
                  ? "ring-1 shadow-[0_0_18px_-5px_currentColor] scale-[1.02]"
                  : "ring-1 ring-white/10 hover:ring-white/30",
              ].join(" ")}
              style={{
                color: opened ? tintColor : "rgba(255,255,255,0.7)",
                background: opened
                  ? `linear-gradient(135deg, ${tintColor}26, ${tintColor}10)`
                  : "rgba(255,255,255,0.03)",
                borderColor: opened ? `${tintColor}66` : undefined,
              }}
            >
              <g.Icon className="h-3.5 w-3.5" />
              <span>{g.label}</span>
              {active && !opened && (
                <span
                  className="inline-block h-1 w-1 rounded-full"
                  style={{ background: g.tint, boxShadow: `0 0 6px ${g.tint}` }}
                />
              )}
              {showAlert && (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[1rem] h-4 px-1 rounded-full text-[9px] font-extrabold bg-rose-500/25 text-rose-200 ring-1 ring-rose-400/50 tabular-nums">
                  {alertsUnread > 99 ? "99+" : alertsUnread}
                </span>
              )}
            </button>
          );
        })}
      </ScrollRow>

      {/* Row 2: Pages within active category */}
      {activeGroup && (
        <ScrollRow className="px-3 sm:px-6 pb-2 pt-1.5">
          {activeGroup.items.map((n) => {
            const active = isActive(n);
            const showBadge = n.to === alertsTo && alertsUnread > 0;
            return (
              <Link
                key={n.to}
                to={n.to}
                aria-current={active ? "page" : undefined}
                title={n.desc}
                className={[
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-bold transition shrink-0 active:scale-[0.97]",
                  active
                    ? "bg-gold/15 text-gold ring-1 ring-gold/45 shadow-[0_0_14px_-6px_rgba(255,209,102,0.7)]"
                    : "text-white/65 hover:text-white hover:bg-white/5 ring-1 ring-transparent",
                ].join(" ")}
              >
                <n.Icon className={`h-3.5 w-3.5 ${active ? "text-gold" : "text-white/45"}`} />
                <span className="tracking-tight">{n.label}</span>
                {showBadge && (
                  <span className="ml-0.5 inline-flex items-center justify-center min-w-[1rem] h-4 px-1 rounded-full text-[9px] font-extrabold bg-rose-500/25 text-rose-200 ring-1 ring-rose-400/50 tabular-nums">
                    {alertsUnread > 99 ? "99+" : alertsUnread}
                  </span>
                )}
              </Link>
            );
          })}
        </ScrollRow>
      )}
    </nav>
  );
}

function pillClass(active: boolean, tint: string) {
  return [
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] transition shrink-0 active:scale-[0.97] ring-1",
    active
      ? "shadow-[0_0_14px_-6px_currentColor]"
      : "ring-white/10 hover:ring-white/30 text-white/70",
  ].join(" ") + (active
    ? ""
    : ""
  ) + ` `
  + (active
    ? `text-[${tint}]`
    : "");
}

function ScrollRow({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setOverflow({
        left: el.scrollLeft > 4,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, []);

  const nudge = (delta: number) => {
    ref.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <div className={`relative ${className ?? ""}`}>
      {/* Edge fades */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-0 w-6 z-[5] transition-opacity ${overflow.left ? "opacity-100" : "opacity-0"}`}
        style={{ background: "linear-gradient(to right, var(--background) 0%, transparent 100%)" }}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 w-6 z-[5] transition-opacity ${overflow.right ? "opacity-100" : "opacity-0"}`}
        style={{ background: "linear-gradient(to left, var(--background) 0%, transparent 100%)" }}
      />
      {overflow.left && (
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => nudge(-200)}
          className="hidden md:flex absolute left-1 top-1/2 -translate-y-1/2 z-10 h-6 w-6 items-center justify-center rounded-full bg-background/90 ring-1 ring-white/15 text-white/70 hover:text-white"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      )}
      <div
        ref={ref}
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth"
        style={{ scrollbarWidth: "none" }}
      >
        {children}
      </div>
      {overflow.right && (
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => nudge(200)}
          className="hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 z-10 h-6 w-6 items-center justify-center rounded-full bg-background/90 ring-1 ring-white/15 text-white/70 hover:text-white"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}