export function PowerToggle({
  title, Icon, active, activeLabel, inactiveLabel, activeTint, inactiveTint,
  activeHint, inactiveHint, onToggle, saving, ready,
}: {
  title: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  activeTint: string;
  inactiveTint: string;
  activeHint: string;
  inactiveHint: string;
  onToggle: () => void;
  saving: boolean;
  ready: boolean;
}) {
  const tint = active ? activeTint : inactiveTint;
  const label = active ? activeLabel : inactiveLabel;
  const hint = active ? activeHint : inactiveHint;
  const disabled = !ready || saving;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={active}
      className="group relative text-left rounded-2xl p-4 border transition-all duration-200 active:scale-[0.98] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      style={{
        borderColor: `${tint}66`,
        background: `linear-gradient(135deg, ${tint}14 0%, rgba(0,0,0,0.25) 100%)`,
        boxShadow: active ? `0 0 28px -10px ${tint}` : "0 0 0 transparent",
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <span
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition"
          style={{
            background: `${tint}22`,
            border: `1px solid ${tint}66`,
            boxShadow: active ? `inset 0 0 12px -2px ${tint}` : "none",
          }}
        >
          <Icon className="h-5 w-5" style={{ color: tint }} />
        </span>
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-[0.2em] tabular-nums"
          style={{ background: `${tint}1f`, color: tint, border: `1px solid ${tint}77` }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{
              background: tint,
              boxShadow: `0 0 8px ${tint}`,
              animation: active ? "pulse 1.8s ease-in-out infinite" : undefined,
            }}
          />
          {label}
        </span>
      </div>
      <div className="text-sm font-bold text-white/95 tracking-tight">{title}</div>
      <div className="mt-1 text-[11px] text-white/55 leading-snug min-h-[2.4em]">{hint}</div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.25em] terminal-mono text-white/40">
          {disabled ? (saving ? "Saving…" : "Loading…") : "Tap to toggle"}
        </span>
        <span
          className="relative inline-flex h-6 w-11 items-center rounded-full transition"
          style={{
            background: active ? tint : "rgba(255,255,255,0.12)",
            boxShadow: active ? `0 0 14px -2px ${tint}` : "inset 0 0 0 1px rgba(255,255,255,0.08)",
          }}
        >
          <span
            className="inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-all"
            style={{ transform: `translateX(${active ? "22px" : "2px"})` }}
          />
        </span>
      </div>
    </button>
  );
}
