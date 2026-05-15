import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ScrollText, Loader2, Save, ShieldAlert, Filter, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { requireBoss } from "@/lib/route-guards";
import { useServerFn } from "@tanstack/react-start";
import { bossListExposedFunctions, bossUpsertFunctionAudit } from "@/lib/boss-function-grants.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/boss/function-audit")({
  beforeLoad: requireBoss,
  component: FunctionAuditPage,
  head: () => ({
    meta: [
      { title: "Function Audit — Boss" },
      { name: "description", content: "Boss-only audit of every database function callable by anon or signed-in users." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type Status = "needs_review" | "justified" | "revoke";
type Row = {
  schema_name: string;
  function_name: string;
  arguments: string;
  signature: string;
  security_definer: boolean;
  anon_can_execute: boolean;
  authenticated_can_execute: boolean;
  public_can_execute: boolean;
  justification: string;
  status: Status;
  reviewed_at: string | null;
};

const STATUS_META: Record<Status, { label: string; Icon: typeof CheckCircle2; cls: string }> = {
  needs_review: { label: "Needs review", Icon: AlertTriangle, cls: "border-amber-500/40 bg-amber-500/10 text-amber-200" },
  justified:    { label: "Justified",    Icon: CheckCircle2,  cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" },
  revoke:       { label: "Should revoke", Icon: XCircle,      cls: "border-rose-500/40 bg-rose-500/10 text-rose-200" },
};

function FunctionAuditPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "anon" | Status>("all");
  const [search, setSearch] = useState("");
  const listExposed = useServerFn(bossListExposedFunctions);
  const upsertAudit = useServerFn(bossUpsertFunctionAudit);

  const { data, isLoading, error } = useQuery({
    queryKey: ["boss-exposed-functions"],
    queryFn: async (): Promise<Row[]> => {
      const { rows } = await listExposed();
      return rows as Row[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: { signature: string; justification: string; status: Status }) => {
      await upsertAudit({ data: input });
    },
    onSuccess: () => {
      toast.success("Audit note saved");
      qc.invalidateQueries({ queryKey: ["boss-exposed-functions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const counts = useMemo(() => {
    const c = { total: 0, anon: 0, definer: 0, needs_review: 0, justified: 0, revoke: 0 };
    const seen = new Set<string>();
    for (const r of data ?? []) {
      if (seen.has(r.signature)) continue; // dedupe by pg_proc signature
      seen.add(r.signature);
      c.total++;
      if (r.anon_can_execute) c.anon++;
      if (r.security_definer) c.definer++;
      c[r.status]++;
    }
    return c;
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (filter === "anon" && !r.anon_can_execute) return false;
      if (filter !== "all" && filter !== "anon" && r.status !== filter) return false;
      if (q && !r.signature.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, filter, search]);

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 via-card to-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 ring-1 ring-gold/40">
            <ScrollText className="h-5 w-5 text-gold" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="syndicate-header text-2xl text-foreground">Function Audit</h1>
            <p className="text-sm text-muted-foreground">
              Every database function in the <code className="font-mono">public</code> schema with EXECUTE granted to
              {" "}<code className="font-mono">anon</code>, <code className="font-mono">authenticated</code>, or
              {" "}<code className="font-mono">PUBLIC</code>. Document why each one must remain callable, or mark it for revoke.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Functions marked <strong>Should revoke</strong> still need a follow-up migration to actually drop the grant.
            This page only records intent.
          </span>
        </div>
        {data && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <Stat label="Exposed total" value={counts.total} />
            <Stat label="Anon-callable" value={counts.anon} tone="rose" />
            <Stat label="Unique definer fns" value={counts.definer} tone="amber" />
            <Stat label="Needs review" value={counts.needs_review} tone="amber" />
            <Stat label="Justified" value={counts.justified} tone="emerald" />
            <Stat label="Should revoke" value={counts.revoke} tone="rose" />
          </div>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {(["all", "anon", "needs_review", "justified", "revoke"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-md border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${
              filter === f ? "border-gold/60 bg-gold/15 text-gold" : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.replace("_", " ")}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by name…"
          className="ml-auto min-w-[200px] rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-xs outline-none focus:border-gold/50"
        />
      </div>

      {error && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
          {(error as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading function inventory…
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <FunctionRow key={r.signature} row={r} onSave={(j, s) => upsert.mutateAsync({ signature: r.signature, justification: j, status: s })} />
          ))}
          {filtered.length === 0 && (
            <li className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No functions match this filter.
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "amber" | "emerald" | "rose" }) {
  const cls =
    tone === "amber" ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
    : tone === "emerald" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
    : tone === "rose" ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
    : "border-border bg-secondary/40 text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 ${cls}`}>
      <span className="font-bold">{value}</span>
      <span className="uppercase tracking-[0.15em] text-[10px]">{label}</span>
    </span>
  );
}

function FunctionRow({ row, onSave }: { row: Row; onSave: (justification: string, status: Status) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [justification, setJustification] = useState(row.justification);
  const [status, setStatus] = useState<Status>(row.status);
  const [saving, setSaving] = useState(false);
  const meta = STATUS_META[row.status];

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <code className="font-mono text-sm font-bold text-foreground break-all">
              {row.function_name}({row.arguments || ""})
            </code>
            {row.security_definer && (
              <span className="rounded-md border border-purple-500/40 bg-purple-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-purple-200">
                definer
              </span>
            )}
            {row.anon_can_execute && (
              <span className="rounded-md border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-rose-200">
                anon
              </span>
            )}
            {row.authenticated_can_execute && (
              <span className="rounded-md border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-sky-200">
                auth
              </span>
            )}
            {row.public_can_execute && (
              <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-amber-200">
                public
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
            <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 ${meta.cls}`}>
              <meta.Icon className="h-3 w-3" /> {meta.label}
            </span>
            {row.reviewed_at && (
              <span className="text-muted-foreground">reviewed {new Date(row.reviewed_at).toLocaleString()}</span>
            )}
            {row.justification && !open && (
              <span className="text-muted-foreground">— {row.justification.slice(0, 80)}{row.justification.length > 80 ? "…" : ""}</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-border bg-secondary px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-foreground hover:bg-secondary/80"
        >
          {open ? "Close" : "Review"}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          <textarea
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            rows={3}
            placeholder="Why must this function remain callable by anon/authenticated? Which app code calls it? What checks does it enforce internally?"
            className="w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-gold/50"
          />
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(STATUS_META) as Status[]).map((s) => {
              const m = STATUS_META[s];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] ${
                    status === s ? m.cls : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <m.Icon className="h-3.5 w-3.5" /> {m.label}
                </button>
              );
            })}
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try { await onSave(justification, status); } finally { setSaving(false); }
              }}
              className="ml-auto inline-flex items-center gap-2 rounded-md border border-gold/40 bg-gold/15 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-gold hover:bg-gold/25 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save note
            </button>
          </div>
        </div>
      )}
    </li>
  );
}