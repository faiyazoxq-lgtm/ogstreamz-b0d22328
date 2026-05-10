import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Flame, X, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { vaultPortalLogin } from "@/lib/vault-portal-auth.functions";

type Props = { open: boolean; onClose: () => void };

export function VaultLoginModal({ open, onClose }: Props) {
  const login = useServerFn(vaultPortalLogin);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [granted, setGranted] = useState(false);
  const firstRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setGranted(false);
    setPassword("");
    const t = setTimeout(() => firstRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const r: any = await login({ data: { username: username.trim(), password } });
      if (r?.ok) {
        setGranted(true);
        setPassword("");
        toast.success("Vault unlocked");
      } else {
        toast.error(r?.error || "Access denied");
      }
    } catch (err: any) {
      toast.error(err?.message || "Vault offline");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-login-title"
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      <div
        className="relative w-full max-w-md"
        style={{
          // Sharp metal-edge frame via clip-path
          clipPath:
            "polygon(18px 0, calc(100% - 18px) 0, 100% 18px, 100% calc(100% - 18px), calc(100% - 18px) 100%, 18px 100%, 0 calc(100% - 18px), 0 18px)",
        }}
      >
        {/* Outer chrome bevel */}
        <div
          className="p-[1.5px]"
          style={{
            background:
              "linear-gradient(135deg, #6f7a86 0%, #1c2330 18%, #aab4c2 38%, #0b0f17 55%, #5a6472 75%, #1a2030 100%)",
            clipPath:
              "polygon(18px 0, calc(100% - 18px) 0, 100% 18px, 100% calc(100% - 18px), calc(100% - 18px) 100%, 18px 100%, 0 calc(100% - 18px), 0 18px)",
          }}
        >
          <div
            className="relative overflow-hidden"
            style={{
              background:
                "linear-gradient(180deg, #0a0f1a 0%, #0c1422 45%, #07101c 100%)",
              clipPath:
                "polygon(18px 0, calc(100% - 18px) 0, 100% 18px, 100% calc(100% - 18px), calc(100% - 18px) 100%, 18px 100%, 0 calc(100% - 18px), 0 18px)",
            }}
          >
            {/* Deep blue flame ambience */}
            <div className="pointer-events-none absolute -top-24 -left-16 h-72 w-72 rounded-full blur-3xl"
              style={{ background: "radial-gradient(closest-side, oklch(0.55 0.28 255 / 0.55), transparent)" }} />
            <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full blur-3xl"
              style={{ background: "radial-gradient(closest-side, oklch(0.45 0.30 265 / 0.5), transparent)" }} />
            <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0 1px, transparent 1px 3px)",
              }} />

            {/* Close */}
            <button
              onClick={onClose}
              aria-label="Close vault"
              className="absolute top-3 right-3 z-10 h-8 w-8 grid place-items-center rounded-md border border-white/10 bg-black/50 text-white/70 hover:text-white hover:border-white/30"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative px-6 sm:px-8 pt-7 pb-7">
              {/* Header */}
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.45em] font-bold"
                style={{ color: "var(--neon-blue-bright)" }}>
                <Flame className="h-3.5 w-3.5" />
                <span>0G — Vault</span>
              </div>
              <h2
                id="vault-login-title"
                className="mt-2 font-[Montserrat] font-black text-2xl sm:text-3xl tracking-tight text-metallic"
              >
                STREAM PROFILE DETAILS
              </h2>
              <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-white/45 font-bold">
                Authenticate to enter
              </p>

              {granted ? (
                <div className="mt-6 rounded-md border border-[oklch(0.72_0.22_245/0.5)] bg-[oklch(0.55_0.28_255/0.12)] p-5 text-center">
                  <p className="text-[10px] uppercase tracking-[0.4em] font-bold" style={{ color: "var(--neon-blue-bright)" }}>
                    Access granted
                  </p>
                  <p className="mt-2 text-sm text-white/80">The vault recognises you. Welcome back.</p>
                  <button
                    onClick={onClose}
                    className="mt-5 inline-flex items-center justify-center px-5 py-2.5 text-[11px] uppercase tracking-[0.3em] font-bold text-white btn-glass-blue rounded-md"
                  >
                    Continue
                  </button>
                </div>
              ) : (
                <form onSubmit={submit} className="mt-6 space-y-4">
                  <Field
                    label="USERNAME"
                    inputRef={firstRef}
                    value={username}
                    onChange={setUsername}
                    autoComplete="username"
                    type="text"
                  />
                  <Field
                    label="PASSWORD"
                    value={password}
                    onChange={setPassword}
                    autoComplete="current-password"
                    type={showPwd ? "text" : "password"}
                    rightAdornment={
                      <button
                        type="button"
                        onClick={() => setShowPwd((v) => !v)}
                        className="text-white/50 hover:text-white"
                        aria-label={showPwd ? "Hide password" : "Show password"}
                      >
                        {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                  />

                  <button
                    type="submit"
                    disabled={busy || !username.trim() || !password}
                    className="group relative w-full overflow-hidden rounded-md px-5 py-3 text-[12px] uppercase tracking-[0.4em] font-black text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background:
                        "linear-gradient(180deg, oklch(0.55 0.28 260) 0%, oklch(0.42 0.30 265) 50%, oklch(0.30 0.28 260) 100%)",
                      boxShadow:
                        "0 0 0 1px oklch(0.85 0.18 235 / 0.6) inset, 0 0 24px oklch(0.55 0.28 260 / 0.7), 0 0 60px -10px oklch(0.72 0.22 245 / 0.9)",
                    }}
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 opacity-60"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 40%, rgba(0,0,0,0.35) 100%)",
                      }}
                    />
                    <span className="relative inline-flex items-center justify-center gap-2">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
                      {busy ? "Unlocking…" : "UNLOC THE VAULT"}
                    </span>
                  </button>

                  <p className="text-center text-[10px] uppercase tracking-[0.3em] text-white/40">
                    Credentials are never stored
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type, autoComplete, inputRef, rightAdornment,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  autoComplete?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  rightAdornment?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block mb-1.5 text-[10px] uppercase tracking-[0.4em] font-bold text-white/60">
        {label}
      </span>
      <div
        className="flex items-center gap-2 px-3 py-2 border bg-black/60"
        style={{
          borderColor: "oklch(0.72 0.22 245 / 0.45)",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 18px -6px oklch(0.72 0.22 245 / 0.6)",
          clipPath:
            "polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)",
        }}
      >
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          spellCheck={false}
          className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/30 tracking-wider"
        />
        {rightAdornment}
      </div>
    </label>
  );
}