import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Flame, X, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { vaultPortalLogin } from "@/lib/vault-portal-auth.functions";
import { setVaultUnlocked, clearVaultUnlock } from "@/lib/vault-unlock";
import vaultSafe from "@/assets/og-vault-safe.png";

type Props = { open: boolean; onClose: () => void };

export function VaultLoginModal({ open, onClose }: Props) {
  const login = useServerFn(vaultPortalLogin);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [granted, setGranted] = useState(false);
  const [expires, setExpires] = useState<string | number | null>(null);
  const firstRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setGranted(false);
    setExpires(null);
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
        setExpires(r?.expires ?? null);
        setPassword("");
        setVaultUnlocked();
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
                <div className="mt-6 rounded-md border border-[oklch(0.72_0.22_245/0.5)] bg-[oklch(0.55_0.28_255/0.12)] p-5 text-center overflow-hidden">
                  {/* Animated safe reveal */}
                  <div className="relative mx-auto h-44 w-full max-w-[320px]">
                    {/* Pulsing blue flame halo */}
                    <div
                      aria-hidden
                      className="absolute inset-0 rounded-full blur-2xl"
                      style={{
                        background:
                          "radial-gradient(closest-side, oklch(0.72 0.22 245 / 0.85), oklch(0.45 0.30 265 / 0.35) 55%, transparent 75%)",
                        animation: "vault-flame-pulse 1.6s ease-in-out infinite",
                      }}
                    />
                    {/* Sparks */}
                    <span aria-hidden className="absolute left-3 top-2 h-1 w-1 rounded-full bg-[oklch(0.85_0.18_235)]"
                      style={{ animation: "vault-spark 1.4s ease-out infinite", animationDelay: "0.1s" }} />
                    <span aria-hidden className="absolute right-4 top-6 h-1 w-1 rounded-full bg-[oklch(0.85_0.18_235)]"
                      style={{ animation: "vault-spark 1.6s ease-out infinite", animationDelay: "0.5s" }} />
                    <span aria-hidden className="absolute left-8 bottom-4 h-1 w-1 rounded-full bg-[oklch(0.85_0.18_235)]"
                      style={{ animation: "vault-spark 1.8s ease-out infinite", animationDelay: "0.3s" }} />
                    {/* Safe image */}
                    <img
                      src={vaultSafe}
                      alt="OG-Vault unlocked"
                      className="relative mx-auto h-full w-auto object-contain"
                      style={{
                        animation:
                          "vault-safe-open 1.1s cubic-bezier(.2,.8,.2,1) forwards, vault-safe-float 3.2s ease-in-out 1.1s infinite",
                        filter:
                          "drop-shadow(0 0 18px oklch(0.55 0.28 260 / 0.85)) drop-shadow(0 0 38px oklch(0.45 0.30 265 / 0.55))",
                      }}
                    />
                    {/* Sweep shine */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.55) 50%, transparent 65%)",
                        mixBlendMode: "screen",
                        animation: "vault-shine-sweep 1.4s ease-out 0.3s 1 forwards",
                        opacity: 0,
                      }}
                    />
                  </div>

                  <p className="mt-3 text-[10px] uppercase tracking-[0.4em] font-bold animate-fade-in"
                    style={{ color: "var(--neon-blue-bright)", animationDelay: "0.6s", animationFillMode: "both" }}>
                    Access granted
                  </p>
                  <p className="mt-2 text-sm text-white/80 animate-fade-in"
                    style={{ animationDelay: "0.8s", animationFillMode: "both" }}>
                    The vault recognises you. Welcome back.
                  </p>
                  {(() => {
                    const formatted = formatExpiry(expires);
                    if (!formatted) return null;
                    return (
                      <div
                        className="mt-3 inline-flex flex-col items-center gap-0.5 rounded-md border border-[oklch(0.72_0.22_245/0.45)] bg-black/40 px-3 py-2 animate-fade-in"
                        style={{ animationDelay: "0.9s", animationFillMode: "both" }}
                      >
                        <span className="text-[9px] uppercase tracking-[0.4em] font-bold text-white/55">
                          Session expires
                        </span>
                        <span
                          className="text-[12px] font-mono tracking-wider"
                          style={{ color: "var(--neon-blue-bright)" }}
                        >
                          {formatted}
                        </span>
                      </div>
                    );
                  })()}
                  <button
                    onClick={onClose}
                    className="mt-5 inline-flex items-center justify-center px-5 py-2.5 text-[11px] uppercase tracking-[0.3em] font-bold text-white btn-glass-blue rounded-md animate-fade-in"
                    style={{ animationDelay: "1s", animationFillMode: "both" }}
                  >
                    Continue
                  </button>
                  <button
                    onClick={() => {
                      clearVaultUnlock();
                      setGranted(false);
                      setExpires(null);
                      setUsername("");
                      setPassword("");
                      toast.success("Vault locked");
                      onClose();
                    }}
                    className="mt-2 ml-2 inline-flex items-center justify-center px-5 py-2.5 text-[11px] uppercase tracking-[0.3em] font-bold text-white/80 rounded-md border border-white/15 bg-black/40 hover:text-white hover:border-white/30 animate-fade-in"
                    style={{ animationDelay: "1.05s", animationFillMode: "both" }}
                  >
                    Log out
                  </button>

                  <style>{`
                    @keyframes vault-safe-open {
                      0%   { opacity: 0; transform: scale(0.55) rotate(-14deg); filter: blur(6px) drop-shadow(0 0 0 transparent); }
                      55%  { opacity: 1; transform: scale(1.08) rotate(3deg); filter: blur(0) drop-shadow(0 0 28px oklch(0.72 0.22 245 / 0.95)); }
                      78%  { transform: scale(0.97) rotate(-1deg); }
                      100% { opacity: 1; transform: scale(1) rotate(0deg); }
                    }
                    @keyframes vault-safe-float {
                      0%, 100% { transform: translateY(0) scale(1); }
                      50%      { transform: translateY(-4px) scale(1.015); }
                    }
                    @keyframes vault-flame-pulse {
                      0%, 100% { opacity: 0.55; transform: scale(0.95); }
                      50%      { opacity: 1;    transform: scale(1.08); }
                    }
                    @keyframes vault-shine-sweep {
                      0%   { opacity: 0; transform: translateX(-60%); }
                      40%  { opacity: 1; }
                      100% { opacity: 0; transform: translateX(60%); }
                    }
                    @keyframes vault-spark {
                      0%   { opacity: 0; transform: translateY(0) scale(0.6); }
                      35%  { opacity: 1; }
                      100% { opacity: 0; transform: translateY(-22px) scale(1.2); }
                    }
                  `}</style>
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

function formatExpiry(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  let date: Date | null = null;
  if (typeof value === "number" || /^\d+$/.test(String(value))) {
    const n = Number(value);
    // exp_date from xtream is seconds since epoch
    const ms = n < 1e12 ? n * 1000 : n;
    date = new Date(ms);
  } else {
    const d = new Date(String(value));
    if (!isNaN(d.getTime())) date = d;
  }
  if (!date || isNaN(date.getTime())) return String(value);
  try {
    return date.toLocaleString(undefined, {
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return date.toISOString();
  }
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