import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Tv, CheckCircle2, Loader2, AlertTriangle, Clock, CalendarClock, RefreshCw, CircleDashed, XCircle } from "lucide-react";
import { verifyAndLinkStream, reverifyStream, type StreamReasonCode, type RpcErrorCause } from "@/lib/stream-link.functions";
import { useAuth } from "@/hooks/use-auth";

export function StreamLinkCard() {
  const { profile, refresh } = useAuth();
  const verify = useServerFn(verifyAndLinkStream);
  const reverify = useServerFn(reverifyStream);
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [busy, setBusy] = useState(false);
  const [reverifying, setReverifying] = useState(false);
  const [resubmitCta, setResubmitCta] = useState<{ title: string; detail: string } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [errors, setErrors] = useState<{ username?: string; password?: string; server?: string }>({});
  const [banner, setBanner] = useState<{ reason: StreamReasonCode | "client_validation"; title: string; detail?: string } | null>(null);
  type Phase = "idle" | "pending" | "checking" | "success" | "error";
  const [phase, setPhase] = useState<Phase>("idle");
  const [phaseLabel, setPhaseLabel] = useState<string>("");
  const usernameRef = useRef<HTMLInputElement | null>(null);

  const REASON_TITLES: Record<StreamReasonCode | "client_validation", string> = {
    client_validation: "Fix the highlighted fields",
    invalid_username: "Username looks invalid",
    invalid_password: "Password looks invalid",
    invalid_server: "Server URL looks invalid",
    server_unreachable: "Stream server unreachable",
    server_timeout: "Stream server timed out",
    server_error: "Stream server returned an error",
    credentials_rejected: "Credentials rejected",
    account_expired: "Account expired",
    account_disabled: "Account disabled",
    account_banned: "Account banned",
    rpc_error: "Couldn't save your credentials",
    unknown: "Verification failed",
  };

  const RPC_CAUSE_TITLES: Record<RpcErrorCause, string> = {
    network: "Network problem saving your credentials",
    rate_limit: "Too many attempts — slow down",
    invalid_credentials: "Credentials were rejected",
    resubmit_required: "Please resubmit your credentials",
    save_failed: "We couldn't save your credentials",
    permission_denied: "You don't have permission for that",
    unknown: "Couldn't save your credentials",
  };

  const RPC_CAUSE_HELP: Record<RpcErrorCause, string> = {
    network: "Your connection dropped before we could save the result. Check your internet and try again in a moment.",
    rate_limit: "You've tried this a lot in the last few minutes. Wait ~60 seconds before trying again to avoid being throttled by the stream server.",
    invalid_credentials: "The username or password didn't match. Double-check both fields (no spaces, correct case) and resubmit.",
    resubmit_required: "For security we don't keep your stream password on file. Re-enter your username and password below to re-verify.",
    save_failed: "Verification worked, but saving the result failed. Try submitting once more — if it keeps failing, message Boss.",
    permission_denied: "Your account isn't allowed to perform this action right now. Sign out and back in, then try again.",
    unknown: "Something went wrong on our end. Please try again — if it persists, contact Boss.",
  };

  // Allowed username chars: letters, digits, and . _ - @ + (typical Xtream/IPTV)
  const USERNAME_RE = /^[A-Za-z0-9._\-@+]+$/;
  // Hostname label rules: letters/digits/hyphens, no leading/trailing hyphen, multi-label.
  const HOSTNAME_RE = /^(?=.{1,253}$)(?!-)([A-Za-z0-9-]{1,63}(?<!-)\.)+[A-Za-z]{2,63}$/;
  // Or a bare IPv4
  const IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

  const validate = (un: string, pw: string) => {
    const errs: { username?: string; password?: string; server?: string } = {};

    // Username — trimmed, length, charset
    const t = un.trim();
    if (!t) errs.username = "Username is required.";
    else if (t.length < 2) errs.username = "Username is too short (min 2).";
    else if (t.length > 120) errs.username = "Username is too long (max 120).";
    else if (/\s/.test(t)) errs.username = "Username cannot contain spaces.";
    else if (!USERNAME_RE.test(t)) errs.username = "Only letters, digits, and . _ - @ + are allowed.";

    // Password — length only (no charset restriction; trim disallowed leading/trailing space)
    if (!pw) errs.password = "Password is required.";
    else if (pw !== pw.trim()) errs.password = "Password cannot start or end with a space.";
    else if (pw.length < 2) errs.password = "Password is too short (min 2).";
    else if (pw.length > 200) errs.password = "Password is too long (max 200).";

    return errs;
  };

  const rank = (profile?.rank as string | undefined) ?? "";
  const linked = rank === "stream_user" || rank === "vip" || rank === "boss";
  const status = profile?.stream_status ?? undefined;
  const expiresAt = profile?.stream_expires_at ?? undefined;
  const bossVerifiedAt = (profile as any)?.stream_boss_verified_at ?? undefined;
  const autoCheckedAt = (profile as any)?.stream_auto_checked_at ?? undefined;

  const expiryDate = expiresAt ? new Date(expiresAt) : null;
  const expired = expiryDate ? expiryDate.getTime() < Date.now() : false;
  const daysLeft = expiryDate ? Math.ceil((expiryDate.getTime() - Date.now()) / 86_400_000) : null;
  const expiryLabel = expiryDate
    ? expiryDate.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(u, p);
    setErrors(errs);
    if (Object.keys(errs).length) {
      setMsg(null);
      setBanner({
        reason: "client_validation",
        title: REASON_TITLES.client_validation,
        detail: "Resolve the highlighted fields below and try again.",
      });
      setPhase("error");
      setPhaseLabel("Validation failed");
      return;
    }
    setBusy(true); setMsg(null); setBanner(null);
    setPhase("pending"); setPhaseLabel("Preparing request");
    try {
      setPhase("checking"); setPhaseLabel("Checking credentials with stream server");
      const res = await verify({ data: { username: u.trim(), password: p } });
      if (res.ok) {
        setMsg({ ok: true, text: res.message || "Submitted to Boss for OGSTREAMZ approval." });
        setP("");
        setErrors({});
        setBanner(null);
        setPhase("success"); setPhaseLabel("Submitted to Boss for approval");
        await refresh();
      } else {
        const field = (res as any).field as "username" | "password" | "server" | undefined;
        if (field) setErrors({ [field]: res.error } as any);
        const reason = ((res as any).reason as StreamReasonCode | undefined) ?? "unknown";
        const cause = ((res as any).cause as RpcErrorCause | undefined) ?? null;
        setBanner({
          reason,
          title:
            reason === "rpc_error" && cause
              ? RPC_CAUSE_TITLES[cause]
              : (REASON_TITLES[reason] ?? REASON_TITLES.unknown),
          detail:
            reason === "rpc_error" && cause
              ? RPC_CAUSE_HELP[cause]
              : res.error || undefined,
        });
        setMsg(null);
        setPhase("error");
        setPhaseLabel(reason === "rpc_error" && cause ? RPC_CAUSE_TITLES[cause] : (REASON_TITLES[reason] ?? REASON_TITLES.unknown));
      }
    } catch (e: any) {
      setBanner({
        reason: "unknown",
        title: REASON_TITLES.unknown,
        detail: e?.message || undefined,
      });
      setPhase("error"); setPhaseLabel("Verification failed");
    } finally { setBusy(false); }
  };

  const onReverify = async () => {
    // Reverify uses no form input today, but if the user has typed credentials
    // (e.g. about to resubmit) gate on the same client-side rules so we never
    // call the server with malformed values.
    if (u || p) {
      const errs = validate(u || "x", p || "xx");
      // Only block on username format problems (password is optional here).
      if (errs.username) {
        setErrors(errs);
        setBanner({
          reason: "client_validation",
          title: REASON_TITLES.client_validation,
          detail: "Fix the highlighted fields before re-verifying.",
        });
        setPhase("error"); setPhaseLabel("Validation failed");
        return;
      }
    }
    setReverifying(true);
    setResubmitCta(null);
    setMsg(null);
    setBanner(null);
    setPhase("pending"); setPhaseLabel("Preparing re-verification");
    try {
      setPhase("checking"); setPhaseLabel("Re-checking with stream server");
      const res = await reverify({ data: {} });
      if (!res.ok && res.reason === "rpc_error") {
        const cause = ((res as any).cause as RpcErrorCause | undefined) ?? "unknown";
        if (cause === "resubmit_required") {
          setResubmitCta({
            title: RPC_CAUSE_TITLES.resubmit_required,
            detail: RPC_CAUSE_HELP.resubmit_required,
          });
          setU("");
          setP("");
          setPhase("pending"); setPhaseLabel("Awaiting resubmitted credentials");
          requestAnimationFrame(() => usernameRef.current?.focus());
        } else {
          setBanner({
            reason: "rpc_error",
            title: RPC_CAUSE_TITLES[cause],
            detail: RPC_CAUSE_HELP[cause],
          });
          setPhase("error"); setPhaseLabel(RPC_CAUSE_TITLES[cause]);
        }
      } else if (!res.ok) {
        setMsg({ ok: false, text: res.error || "Re-verification failed." });
        setPhase("error"); setPhaseLabel("Re-verification failed");
      } else {
        setPhase("success"); setPhaseLabel("Re-verified");
      }
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "Re-verification failed." });
      setPhase("error"); setPhaseLabel("Re-verification failed");
    } finally {
      setReverifying(false);
    }
  };

  const inFlight = busy || reverifying;

  const Stepper = () => {
    if (phase === "idle") return null;
    const steps: Array<{ key: Phase; label: string }> = [
      { key: "pending", label: "Pending" },
      { key: "checking", label: "Checking" },
      { key: phase === "error" ? "error" : "success", label: phase === "error" ? "Error" : "Result" },
    ];
    const order = ["pending", "checking", "success"] as const;
    const currentIdx = phase === "error" ? 2 : order.indexOf(phase as any);
    return (
      <div
        role="status"
        aria-live="polite"
        className="mt-4 rounded-md border border-border bg-background/40 px-3 py-2.5"
      >
        <div className="flex items-center gap-2">
          {steps.map((s, i) => {
            const isCurrent = i === currentIdx;
            const isDone = i < currentIdx;
            const isError = phase === "error" && i === 2;
            const isSuccess = phase === "success" && i === 2;
            const Icon = isError ? XCircle : isSuccess ? CheckCircle2 : isCurrent ? Loader2 : isDone ? CheckCircle2 : CircleDashed;
            const color = isError
              ? "text-destructive"
              : isSuccess
                ? "text-emerald-400"
                : isCurrent
                  ? "text-primary"
                  : isDone
                    ? "text-emerald-400/80"
                    : "text-muted-foreground/70";
            return (
              <div key={s.label} className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] ${color}`}>
                  <Icon className={`h-3.5 w-3.5 ${isCurrent && !isError && !isSuccess ? "animate-spin" : ""}`} />
                  {s.label}
                </span>
                {i < steps.length - 1 && (
                  <span className={`h-px w-6 ${i < currentIdx ? "bg-emerald-400/60" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>
        {phaseLabel && (
          <p className="mt-1.5 text-xs text-muted-foreground">{phaseLabel}</p>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="flex items-center gap-3 text-muted-foreground text-xs uppercase tracking-[0.3em]">
        <Tv className="h-4 w-4" /> Stream Account Link
      </div>
      <h3 className="mt-3 font-[Montserrat] font-black text-2xl text-metallic">OGSTREAMZ Verification</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Link your stream/IPTV username &amp; password. We auto-check it against the server, then submit it to <strong className="text-foreground">Boss</strong> for OGSTREAMZ approval.
      </p>

      {(status || expiryLabel) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          {status && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-bold uppercase tracking-[0.18em] ${
                expired
                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                  : status === "Active"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    : "border-amber-400/40 bg-amber-400/10 text-amber-300"
              }`}
            >
              {expired ? <AlertTriangle className="h-3.5 w-3.5" /> : status === "Active" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              {expired ? "Expired" : status}
            </span>
          )}
          {status === "Active" && !expired && (
            bossVerifiedAt ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary/10 px-2.5 py-1 font-bold uppercase tracking-[0.18em] text-primary"
                title={`Verified by Boss on ${new Date(bossVerifiedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Verified by Boss
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-2.5 py-1 font-bold uppercase tracking-[0.18em] text-muted-foreground"
                title={autoCheckedAt ? `Auto-checked ${new Date(autoCheckedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}` : "Auto-detected from your stream provider — Boss approval pending"}
              >
                <CircleDashed className="h-3.5 w-3.5" />
                Auto-detected
              </span>
            )
          )}
          {expiryLabel && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 ${
                expired
                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                  : daysLeft !== null && daysLeft <= 7
                    ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                    : "border-border bg-background/50 text-foreground/80"
              }`}
              title={`Stream profile expiry: ${expiryLabel}`}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              {expired
                ? `Expired ${expiryLabel}`
                : `Expires ${expiryLabel}${daysLeft !== null ? ` · ${daysLeft}d left` : ""}`}
            </span>
          )}
        </div>
      )}
      {linked && !status && (
        <p className="mt-3 text-xs text-muted-foreground">Linked — awaiting fresh status check.</p>
      )}

      {linked && (
        <div className="mt-4">
          <button
            type="button"
            onClick={onReverify}
            disabled={inFlight}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-foreground/80 hover:text-foreground hover:border-foreground/40 disabled:opacity-60"
          >
            {reverifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {reverifying ? "Checking…" : "Re-verify status"}
          </button>
        </div>
      )}

      <Stepper />

      {resubmitCta && (
        <div
          role="status"
          className="mt-4 flex items-start gap-3 rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2.5 text-sm text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-bold leading-tight">{resubmitCta.title}</p>
            <p className="mt-0.5 text-xs text-amber-200/90 break-words">{resubmitCta.detail}</p>
            <button
              type="button"
              onClick={() => { setResubmitCta(null); requestAnimationFrame(() => usernameRef.current?.focus()); }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-400 px-2.5 py-1 text-xs font-bold text-background hover:opacity-90"
            >
              <Tv className="h-3.5 w-3.5" />
              Resubmit credentials
            </button>
          </div>
        </div>
      )}

      {banner && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="font-bold leading-tight">{banner.title}</p>
            {banner.detail && (
              <p className="mt-0.5 text-xs text-destructive/90 break-words">{banner.detail}</p>
            )}
          </div>
        </div>
      )}

      <form onSubmit={submit} className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3" aria-busy={inFlight}>
        <fieldset disabled={inFlight} className="contents">
        <div>
          <input
            ref={usernameRef}
            required value={u}
            onChange={(e) => { setU(e.target.value); if (errors.username) setErrors({ ...errors, username: undefined }); }}
            onBlur={() => setErrors({ ...errors, ...validate(u, p, server), password: errors.password, server: errors.server })}
            placeholder="Stream username" autoComplete="username"
            aria-invalid={!!errors.username}
            className={`w-full bg-background/60 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 ${errors.username ? "border-destructive focus:ring-destructive" : "border-border focus:ring-primary"}`}
          />
          {errors.username && <p className="mt-1 text-xs text-destructive">{errors.username}</p>}
        </div>
        <div>
          <input
            required type="password" value={p}
            onChange={(e) => { setP(e.target.value); if (errors.password) setErrors({ ...errors, password: undefined }); }}
            placeholder="Stream password" autoComplete="current-password"
            aria-invalid={!!errors.password}
            className={`w-full bg-background/60 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 ${errors.password ? "border-destructive focus:ring-destructive" : "border-border focus:ring-primary"}`}
          />
          {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password}</p>}
        </div>
        <div className="sm:col-span-2">
          <input
            value={server}
            onChange={(e) => { setServer(e.target.value); if (errors.server) setErrors({ ...errors, server: undefined }); }}
            placeholder="Server URL (e.g. http://host.tld:80)"
            aria-invalid={!!errors.server}
            className={`w-full bg-background/60 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 ${errors.server ? "border-destructive focus:ring-destructive" : "border-border focus:ring-primary"}`}
          />
          {errors.server
            ? <p className="mt-1 text-xs text-destructive">{errors.server}</p>
            : <p className="mt-1 text-xs text-muted-foreground">Include protocol and port if non-standard.</p>}
        </div>
        <button
          type="submit" disabled={inFlight}
          className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-bold hover:opacity-90 disabled:opacity-60"
        >
          {inFlight ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tv className="h-4 w-4" />}
          {busy ? "Verifying…" : reverifying ? "Re-verifying…" : linked ? "Re-verify Stream Account" : "Verify & Upgrade"}
        </button>
        </fieldset>
      </form>

      {msg && (
        <p className={`mt-3 inline-flex items-center gap-2 text-sm ${msg.ok ? "text-emerald-400" : "text-destructive"}`}>
          {msg.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} {msg.text}
        </p>
      )}
    </div>
  );
}