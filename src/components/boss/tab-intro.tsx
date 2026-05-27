import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Shared "this tab is for…" intro pill used across the Boss Mega Dashboard
 * tabbed surfaces (/boss/members, /boss/content, /boss/ops, /boss/infrastructure).
 *
 * Visual contract:
 *  - bordered card with a tinted left rule matching the tab's accent
 *  - icon + label + (optional) UPPERCASE group tag + plain-language purpose
 *  - optional trailing `children` slot for tab-specific hints / inline links
 *
 * Keeping this in one place ensures every Boss tab feels like the same system.
 */
export function BossTabIntro({
  icon: Icon,
  label,
  purpose,
  tint,
  group,
  children,
}: {
  icon: LucideIcon;
  label: string;
  purpose: string;
  tint: string;
  group?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-white/55"
      style={{ borderLeft: `2px solid ${tint}` }}
    >
      <span className="inline-flex items-center gap-1.5 font-semibold text-white/80">
        <Icon className="h-3.5 w-3.5" style={{ color: tint }} />
        {label}
      </span>
      {group ? (
        <span
          className="text-[10px] uppercase tracking-[0.2em] font-bold"
          style={{ color: tint }}
        >
          {group}
        </span>
      ) : null}
      <span>{purpose}</span>
      {children}
    </div>
  );
}
