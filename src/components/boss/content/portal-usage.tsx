import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Coins,
  RefreshCw,
  Search,
  Download,
  Gift,
  Activity,
  FileText,
  ShieldCheck,
  Clock,
  Inbox,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

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
  useEffect(() => {
    void load();
  }, [limit]);

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Coins className="h-6 w-6 text-primary" />
            Portal Usage Audit
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <p className="text-sm text-muted-foreground">
              Charged and free portal activity, newest first.
            </p>
            <Badge variant="outline" className="text-xs gap-1 font-normal">
              <ShieldCheck className="h-3 w-3" />
              Read-only review surface
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Search & limit */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search portal slug, user ID, or email…"
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Stat
          label="Actions"
          value={totals.count.toString()}
          icon={Activity}
          tint="#60a5fa"
        />
        <Stat
          label="Coins charged"
          value={totals.totalCost.toString()}
          icon={Coins}
          tint="#fbbf24"
        />
        <Stat
          label="Free / privileged"
          value={totals.freeCount.toString()}
          icon={Gift}
          tint="#34d399"
        />
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium w-[140px]">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Time
                </span>
              </th>
              <th className="text-left px-3 py-2 font-medium">
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  Portal
                </span>
              </th>
              <th className="text-left px-3 py-2 font-medium">User</th>
              <th className="text-right px-3 py-2 font-medium w-[110px]">Cost</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="h-5 w-5 animate-spin opacity-50" />
                    <span>Loading usage records…</span>
                  </div>
                </td>
              </tr>
            )}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-12 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Inbox className="h-8 w-8 opacity-40" />
                    <div>
                      <p className="text-sm font-medium text-foreground">No usage records</p>
                      <p className="text-xs mt-0.5">
                        {q.trim()
                          ? "Try a different search term."
                          : "Portal activity will appear here once members start using portals."}
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            )}

            {!loading &&
              filtered.map((r) => {
                const p = profiles[r.user_id];
                return (
                  <tr
                    key={r.id}
                    className="border-t border-border hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      <span title={new Date(r.created_at).toLocaleString()}>
                        {relativeTime(r.created_at)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        to="/p/$slug"
                        params={{ slug: r.portal_slug }}
                        className="text-primary hover:underline font-mono text-[13px]"
                      >
                        {r.portal_slug}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-foreground text-[13px]">
                        {p?.email ?? (
                          <span className="text-muted-foreground italic">No email</span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                        {r.user_id.slice(0, 8)}…
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {r.free ? (
                        <span className="inline-flex items-center gap-1 text-emerald-500 font-medium text-[13px]">
                          <Gift className="h-3.5 w-3.5" />
                          FREE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-[13px]">
                          <span className="tabular-nums">{r.cost}</span>
                          <Coins className="h-3.5 w-3.5 text-amber-400" />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Footer count */}
      {!loading && filtered.length > 0 && (
        <div className="mt-3 text-xs text-muted-foreground text-right">
          Showing {filtered.length} of {rows.length} records
          {q.trim() ? ` (filtered by "${q.trim()}")` : ""}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tint,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  tint: string;
}) {
  return (
    <div className="border border-border rounded-lg px-4 py-3 bg-card">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color: tint }} />
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
      </div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
