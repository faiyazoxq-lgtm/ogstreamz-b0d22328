import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ShieldOff, Loader2, Undo2, Filter, AlertTriangle, ScrollText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { requireBoss } from "@/lib/route-guards";
import { toast } from "sonner";

export const Route = createFileRoute("/boss/function-grants")({
  beforeLoad: requireBoss,
  component: FunctionGrantsPage,
  head: () => ({
    meta: [
      { title: "Function Grants — Boss" },
      { name: "description", content: "Boss-only revoke/restore of EXECUTE grants on database functions, with full audit log." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type Exposed = {
  schema_name: string;
  function_name: string;
  arguments: string;
  signature: string;
  security_definer: boolean;
  anon_can_execute: boolean;
  authenticated_can_execute: boolean;
  public_can_execute: boolean;
};

type LogRow = {
  id: string;
  signature: string;
  role_name: string;
  reason: string;
  restore_sql: string;
  revoked_at: string;
  revoked_by: string | null;
  restored_at: string | null;
  restored_by: string | null;
  status: "revoked" | "restored";
};

function FunctionGrantsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "anon" | "auth" | "public">("auth");

  const exposed = useQuery({
    queryKey: ["boss-exposed-functions"],
    queryFn: async (): Promise<Exposed[]> => {
      const { data, error } = await supabase.rpc("boss_list_exposed_functions");
      if (error) throw error;
      return (data ?? []) as Exposed[];
    },
  });

  const log = useQuery({
    queryKey: ["boss-grant-log"],
    queryFn: async (): Promise<LogRow[]> => {
      const { data, error } = await supabase.rpc("boss_list_function_grant_log");
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });

  const revoke = useMutation({
    mutationFn: async (input: { signature: string; role_name: string; reason: string }) => {
      const { error } = await supabase.rpc("boss_revoke_function_execute", {
        _signature: input.signature,
        _role_name: input.role_name,
        _reason: input.reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("EXECUTE revoked. Logged for restore.");
      qc.invalidateQueries({ queryKey: ["boss-exposed-functions"] });
      qc.invalidateQueries({ queryKey: ["boss-grant-log"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("boss_restore_function_execute", { _log_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("EXECUTE restored");
      qc.invalidateQueries({ queryKey: ["boss-exposed-functions"] });
      qc.invalidateQueries({ queryKey: ["boss-grant-log"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (exposed.data ?? []).filter((r) => {
      if (filter === "anon" && !r.anon_can_execute) return false;
      if (filter === "auth" && !r.authenticated_can_execute) return false;
      if (filter === "public" && !r.public_can_execute) return false;
      if (q && !r.signature.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [exposed.data, filter, search]);

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-500/10 via-card to-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15 ring-1 ring-rose-500/40">
            <ShieldOff className="h-5 w-5 text-rose-300" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="syndicate-header text-2xl text-foreground">Function Grants</h1>
            <p className="text-sm text-muted-foreground">
              Revoke EXECUTE on any boss/admin RPC that should not be callable by anon or signed-in users.
              Every revoke is logged with the exact restore SQL — re-grant with one click.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Revoking <code className="font-mono">authenticated</code> on a boss RPC will also block <em>you</em> from calling it via the
            client SDK — those calls must move to a service-role edge function. Use this for hardening once the function is no longer
            needed from the browser.
          </span>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {(["auth", "anon", "public", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-md border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${
              filter === f ? "border-gold/60 bg-gold/15 text-gold" : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by name…"
          className="ml-auto min-w-[200px] rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-xs outline-none focus:border-gold/50"
        />
      </div>

      {exposed.isLoading ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading exposed functions…
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <FunctionRow key={r.signature} row={r} onRevoke={(role, reason) => revoke.mutateAsync({ signature: r.signature, role_name: role, reason })} />
          ))}
          {filtered.length === 0 && (
            <li className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No functions match this filter.
            </li>
          )}
        </ul>
      )}

      <header className="flex items-center gap-2 pt-4">
        <ScrollText className="h-4 w-4 text-gold" />
        <h2 className="syndicate-header text-lg text-foreground">Revocation log</h2>
        <span className="text-xs text-muted-foreground">({log.data?.length ?? 0})</span>
      </header>

      {log.isLoading ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading log…
        </div>
      ) : (
        <ul className="space-y-2">
          {(log.data ?? []).map((row) => (
            <li key={row.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="font-mono text-xs text-foreground break-all">{row.signature}</code>
                    <span className="rounded-md border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-sky-200">
                      {row.role_name}
                    </span>
                    <span className={`rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] ${
                      row.status === "restored"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                        : "border-rose-500/40 bg-rose-500/10 text-rose-200"
                    }`}>
                      {row.status}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    revoked {new Date(row.revoked_at).toLocaleString()}
                    {row.restored_at && <> · restored {new Date(row.restored_at).toLocaleString()}</>}
                  </div>
                  {row.reason && <div className="mt-1 text-xs text-muted-foreground">— {row.reason}</div>}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground">restore SQL</summary>
                    <pre className="mt-1 overflow-auto rounded-md border border-border bg-background/50 p-2 text-[11px]">{row.restore_sql}</pre>
                  </details>
                </div>
                {row.status === "revoked" && (
                  <button
                    type="button"
                    onClick={() => restore.mutate(row.id)}
                    disabled={restore.isPending}
                    className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-60"
                  >
                    <Undo2 className="h-3.5 w-3.5" /> Restore
                  </button>
                )}
              </div>
            </li>
          ))}
          {(log.data?.length ?? 0) === 0 && (
            <li className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No revocations yet.
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function FunctionRow({ row, onRevoke }: { row: Exposed; onRevoke: (role: string, reason: string) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const doRevoke = async (role: string) => {
    setBusy(role);
    try { await onRevoke(role, reason); setOpen(false); setReason(""); } finally { setBusy(null); }
  };

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <code className="font-mono text-sm font-bold text-foreground break-all">
              {row.function_name}({row.arguments || ""})
            </code>
            {row.security_definer && (
              <span className="rounded-md border border-purple-500/40 bg-purple-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-purple-200">definer</span>
            )}
            {row.anon_can_execute && (
              <span className="rounded-md border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-rose-200">anon</span>
            )}
            {row.authenticated_can_execute && (
              <span className="rounded-md border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-sky-200">auth</span>
            )}
            {row.public_can_execute && (
              <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-amber-200">public</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-border bg-secondary px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-foreground hover:bg-secondary/80"
        >
          {open ? "Cancel" : "Revoke"}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (e.g. moved to service-role edge function)"
            className="w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-gold/50"
          />
          <div className="flex flex-wrap items-center gap-2">
            {(["anon","authenticated","public"] as const).map((role) => {
              const enabled =
                (role === "anon" && row.anon_can_execute) ||
                (role === "authenticated" && row.authenticated_can_execute) ||
                (role === "public" && row.public_can_execute);
              if (!enabled) return null;
              return (
                <button
                  key={role}
                  type="button"
                  disabled={busy === role}
                  onClick={() => doRevoke(role)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-rose-200 hover:bg-rose-500/20 disabled:opacity-60"
                >
                  {busy === role ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldOff className="h-3.5 w-3.5" />} Revoke from {role}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </li>
  );
}