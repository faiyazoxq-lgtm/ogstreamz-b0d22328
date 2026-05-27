import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Coins, RefreshCw, Search, Download, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AuditRow = {
  id: string;
  user_id: string;
  portal_id: string | null;
  portal_slug: string;
  cost: number;
  free: boolean;
  created_at: string;
};
type ProfileLite = { id: string; email: string | null };

export function PortalUsagePanel() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(200);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("portal_use_audit")
      .select("id,user_id,portal_id,portal_slug,cost,free,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as AuditRow[];
    setRows(list);
    const ids = Array.from(new Set(list.map((r) => r.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,email")
        .in("id", ids);
      const map: Record<string, ProfileLite> = {};
      for (const p of (profs ?? []) as ProfileLite[]) map[p.id] = p;
      setProfiles(map);
    } else {
      setProfiles({});
    }
    setLoading(false);
  }
  useEffect(() => { void load(); }, [limit]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => {
      const email = profiles[r.user_id]?.email?.toLowerCase() ?? "";
      return (
        r.portal_slug.toLowerCase().includes(t) ||
        r.user_id.toLowerCase().includes(t) ||
        email.includes(t)
      );
    });
  }, [rows, q, profiles]);

  const totals = useMemo(() => {
    const totalCost = filtered.reduce((acc, r) => acc + (r.cost || 0), 0);
    const freeCount = filtered.filter((r) => r.free).length;
    return { totalCost, freeCount, count: filtered.length };
  }, [filtered]);

  function exportCsv() {
    const header = ["created_at", "portal_slug", "user_id", "email", "cost", "free"];
    const lines = [header.join(",")];
    for (const r of filtered) {
      const email = profiles[r.user_id]?.email ?? "";
      const row = [r.created_at, r.portal_slug, r.user_id, email, String(r.cost), r.free ? "true" : "false"]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",");
      lines.push(row);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portal-usage-${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen text-foreground p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Coins className="h-6 w-6 text-primary" />
            Portal Usage Audit
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every charged (or free) portal action, newest first.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search slug, user id, email"
            className="pl-9"
          />
        </div>
        <select
          className="bg-background border border-input rounded-md px-3 py-2 text-sm"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
        >
          <option value={100}>Last 100</option>
          <option value={200}>Last 200</option>
          <option value={500}>Last 500</option>
          <option value={1000}>Last 1000</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="Actions" value={totals.count.toString()} />
        <Stat label="Coins charged" value={totals.totalCost.toString()} />
        <Stat label="Free / privileged" value={totals.freeCount.toString()} />
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">When</th>
              <th className="text-left px-3 py-2 font-medium">Portal</th>
              <th className="text-left px-3 py-2 font-medium">User</th>
              <th className="text-right px-3 py-2 font-medium">Cost</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">No usage yet.</td></tr>
            )}
            {!loading && filtered.map((r) => {
              const p = profiles[r.user_id];
              return (
                <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      to="/p/$slug"
                      params={{ slug: r.portal_slug }}
                      className="text-primary hover:underline font-mono"
                    >
                      {r.portal_slug}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-foreground">{p?.email ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{r.user_id}</div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.free ? (
                      <span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
                        <Gift className="h-3.5 w-3.5" /> FREE
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-medium">
                        {r.cost} <Coins className="h-3.5 w-3.5 text-amber-400" />
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-lg px-4 py-3 bg-card">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}