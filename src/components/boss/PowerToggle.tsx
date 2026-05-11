import { useId, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

export type PowerToggleConfirm = {
  /** Which transition needs confirmation. Defaults to "activate". */
  when?: "activate" | "deactivate" | "always";
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Type-to-confirm phrase (case-insensitive). Optional. */
  typeToConfirm?: string;
  /** Visual tone of the dialog. */
  tone?: "danger" | "warning";
};

export function PowerToggle({
  title, Icon, active, activeLabel, inactiveLabel, activeTint, inactiveTint,
  activeHint, inactiveHint, onToggle, saving, ready, confirm,
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
  confirm?: PowerToggleConfirm;
}) {
  const tint = active ? activeTint : inactiveTint;
  const label = active ? activeLabel : inactiveLabel;
  const hint = active ? activeHint : inactiveHint;
  const disabled = !ready || saving;

  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
  const inputId = useId();
  const hintId = useId();

  const nextWillActivate = !active; // toggle flips the state
  const needsConfirm = !!confirm && (
    confirm.when === "always" ||
    (confirm.when ?? "activate") === (nextWillActivate ? "activate" : "deactivate")
  );

  const tone = confirm?.tone ?? "danger";
  const toneColor = tone === "danger" ? "#ff5577" : "#ffd166";
  const phraseOk = !confirm?.typeToConfirm ||
    typed.trim().toLowerCase() === confirm.typeToConfirm.trim().toLowerCase();

  function handleClick() {
    if (disabled) return;
    if (needsConfirm) {
      setTyped("");
      setOpen(true);
    } else {
      onToggle();
    }
  }

  function handleConfirm() {
    setOpen(false);
    setTyped("");
    onToggle();
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && phraseOk && !saving) {
      e.preventDefault();
      handleConfirm();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-pressed={active}
        aria-haspopup={needsConfirm ? "dialog" : undefined}
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
        <div className="text-sm font-bold text-white/95 tracking-tight flex items-center gap-1.5">
          {title}
          {needsConfirm && (
            <AlertTriangle className="h-3.5 w-3.5" style={{ color: toneColor }} aria-hidden />
          )}
        </div>
        <div className="mt-1 text-[11px] text-white/55 leading-snug min-h-[2.4em]">{hint}</div>
        <div className="mt-3 flex items-center justify-between">
          <span
            className="text-[10px] uppercase tracking-[0.25em] terminal-mono"
            style={{ color: needsConfirm ? toneColor : "rgba(255,255,255,0.4)" }}
          >
            {disabled ? (saving ? "Saving…" : "Loading…") : needsConfirm ? "Confirm required" : "Tap to toggle"}
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

      {confirm && (
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent
            className={tone === "danger" ? "border-destructive/40" : "border-amber-400/40"}
            aria-labelledby={`${inputId}-title`}
            aria-describedby={`${inputId}-desc`}
            onEscapeKeyDown={() => setOpen(false)}
          >
            <AlertDialogHeader>
              <AlertDialogTitle
                id={`${inputId}-title`}
                className="flex items-center gap-2"
                style={{ color: toneColor }}
              >
                <AlertTriangle className="h-5 w-5" />
                {confirm.title}
              </AlertDialogTitle>
              <AlertDialogDescription asChild id={`${inputId}-desc`}>
                <div className="space-y-2 text-sm">{confirm.description}</div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            {confirm.typeToConfirm && (
              <div className="space-y-1.5">
                <label
                  htmlFor={inputId}
                  className="text-[10px] uppercase tracking-[0.25em] terminal-mono text-white/55 font-bold"
                >
                  Type <span style={{ color: toneColor }}>{confirm.typeToConfirm}</span> to confirm
                </label>
                <Input
                  id={inputId}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder={confirm.typeToConfirm}
                  className="font-bold tracking-widest"
                  aria-label={`Type ${confirm.typeToConfirm} to confirm`}
                  aria-describedby={hintId}
                  aria-invalid={typed.length > 0 && !phraseOk}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                />
                <p id={hintId} className="sr-only" aria-live="polite">
                  {phraseOk
                    ? "Confirmation phrase matches. Press Enter to confirm."
                    : `You must type ${confirm.typeToConfirm} exactly to enable the confirm button.`}
                </p>
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={saving}>
                {confirm.cancelLabel ?? "Cancel"}
              </AlertDialogCancel>
              <AlertDialogAction
                ref={confirmBtnRef}
                disabled={saving || !phraseOk}
                onClick={handleConfirm}
                aria-disabled={saving || !phraseOk}
                className={
                  tone === "danger"
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : "bg-amber-500 text-black hover:bg-amber-400"
                }
              >
                {saving ? "Working…" : (confirm.confirmLabel ?? "Confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
