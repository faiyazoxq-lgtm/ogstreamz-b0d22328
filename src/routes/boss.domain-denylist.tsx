import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldOff, Plus, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: string;
  domain: string;
  note: string;
  created_at: string;
};

export const Route = createFileRoute("/boss/domain-denylist")({
  beforeLoad: ({ location }) => {
    if (location.pathname.replace(/\/$/, "") === "/boss/domain-denylist") {
      throw redirect({ to: "/boss/infrastructure", hash: "domain-denylist", replace: true });
    }
  },
  component: () => null,
});

export function DomainDenylistPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState("");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase
      .from("domain_denylist")
      .select("id, domain, note, created_at")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data ?? []) as Row[]);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function add() {
    const d = domain.trim();
    if (!d) return;
    setAdding(true);
    const { error } = await supabase.from("domain_denylist").insert({ domain: d, note: note.trim() });
    setAdding(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDomain("");
    setNote("");
    toast.success("Domain blocked sitewide.");
    refresh();
  }

  async function remove(id: string, d: string) {
    if (!confirm(`Unblock ${d}? It will become visible across the site again.`)) return;
    const { error } = await supabase.from("domain_denylist").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Removed from denylist.");
    refresh();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-foreground">
      <header className="mb-8 flex items-start gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ background: "color-mix(in oklab, #ff5577 18%, transparent)", color: "#ff5577" }}
        >
          <ShieldOff className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Domain Denylist</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Any domain added here is scrubbed from every page for every visitor — members, anonymous, and bots.
            Links are removed, embedded media is hidden, and the domain text is replaced with{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">[hidden]</code>.
            Subdomains (e.g. <code className="rounded bg-muted px-1.5 py-0.5">x.example.com</code>) are blocked
            automatically when you block <code className="rounded bg-muted px-1.5 py-0.5">example.com</code>.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Add domain
        </h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
            placeholder="example.com"
            spellCheck={false}
            autoComplete="off"
            disabled={adding}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
            placeholder="Reason (optional)"
            disabled={adding}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <Button onClick={add} disabled={adding || !domain.trim()} className="gap-2">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Block
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Scheme, port and <code>www.</code> are stripped automatically. Pasting a full URL works.
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Blocked domains ({rows.length})
        </h2>
        {loading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            Nothing blocked. The whole site renders as-is.
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="font-mono text-sm">{r.domain}</div>
                  {r.note ? (
                    <div className="mt-0.5 text-xs text-muted-foreground">{r.note}</div>
                  ) : null}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => remove(r.id, r.domain)}
                  className="gap-2 text-rose-400 hover:text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Unblock
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}