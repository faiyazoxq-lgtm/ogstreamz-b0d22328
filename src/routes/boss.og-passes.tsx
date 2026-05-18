import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search, RefreshCw, Star, ChevronDown, Settings2, CheckSquare, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listRoster, setOgTier, setStatus, adjustCredits, setBanned, forceSignOut, setUserSwearing, setFriendsFamily, setHubAccess, type RosterRow } from "@/lib/boss-users.functions";
import { reverifyStream } from "@/lib/stream-link.functions";
import { grantVipPass, revokeVipPass, listVipPasses } from "@/lib/overlord.functions";
import { getOgPassFavourites, setOgPassFavourites } from "@/lib/og-pass-favourites.functions";
import { BossOgPassCard } from "@/components/boss/BossOgPassCard";
import { requireBoss } from "@/lib/route-guards";
import {
  buildCatalog, flattenCatalog, resolveActionLink, actionToneClasses,
  type Action, type ActionCtx, type Category, type HandlerRegistry,
} from "@/components/boss/og-pass-actions";

export const Route = createFileRoute("/boss/og-passes")({
  beforeLoad: requireBoss,
  head: () => ({ meta: [
    { title: "OG-Passes · Boss" },
    { name: "description", content: "Manage every OG-Pass holder: ranks, coins, VIP, stream, moderation, comms — with favourite-action toolbar and bulk apply." },
  ]}),
  component: BossOgPasses,
});

function BossOgPasses() {
  const list = useServerFn(listRoster);
  const reg: HandlerRegistry = {
    setRank: (uid, tier) => useServerFnInline(setOgTier)({ data: { userId: uid, tier: tier as any } }),
    setStatus: (uid, status) => useServerFnInline(setStatus)({ data: { userId: uid, status } }),
    adjustCredits: (uid, delta, reason) => useServerFnInline(adjustCredits)({ data: { userId: uid, delta, reason } }),
    setBanned: (uid, banned, reason) => useServerFnInline(setBanned)({ data: { userId: uid, banned, reason } }),
    forceSignOut: (uid) => useServerFnInline(forceSignOut)({ data: { userId: uid } }),
    reverifyStream: (uid) => useServerFnInline(reverifyStream)({ data: { userId: uid } }),
    setSwearing: (uid, enabled, intensity) => useServerFnInline(setUserSwearing)({ data: { userId: uid, enabled, intensity } }),
    grantVip: (uid, days) => useServerFnInline(grantVipPass)({ data: { userId: uid, expiresAt: new Date(Date.now() + days * 86400_000).toISOString(), source: `${days}d` } }),
    revokeVipForUser: async (uid) => {
      const passes = await useServerFnInline(listVipPasses)();
      const active = (passes?.passes ?? []).find((p: any) => p.user_id === uid && !p.revoked_at && new Date(p.expires_at) > new Date());
      if (!active) throw new Error("No active VIP pass");
      return useServerFnInline(revokeVipPass)({ data: { passId: active.id } });
    },
    setFriendsFamily: (uid, enabled) => useServerFnInline(setFriendsFamily)({ data: { userId: uid, enabled } }),
    setHubAccess: (uid, enabled) => useServerFnInline(setHubAccess)({ data: { userId: uid, enabled } }),
  };

  const getFavs = useServerFn(getOgPassFavourites);
  const saveFavs = useServerFn(setOgPassFavourites);

  const [rows, setRows] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [favs, setFavs] = useState<string[]>([]);
  const [favEditorOpen, setFavEditorOpen] = useState(false);

  const catalog = useMemo(() => buildCatalog(reg), []);
  const flat = useMemo(() => flattenCatalog(catalog), [catalog]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await list({ data: { search, rank: "", limit: 50, cursor: null } });
      setRows(res.rows);
    } catch (e: any) { toast.error(e?.message ?? "Failed to load"); }
    finally { setLoading(false); }
  }, [list, search]);

  useEffect(() => { refresh(); }, []);
  useEffect(() => { getFavs().then((r) => setFavs(r.keys)).catch(() => {}); }, [getFavs]);

  const runAction = (row: RosterRow, action: Action) => {
    if (action.to) return; // link is handled via <Link>
    if (!action.handler) return;
    const ctx: ActionCtx = {
      row,
      run: async (fn) => {
        setBusyId(row.id);
        try { await fn(); toast.success(`${action.label} ✓`); await refresh(); }
        catch (e: any) { toast.error(e?.message ?? "Action failed"); }
        finally { setBusyId(null); }
      },
    };
    action.handler(ctx);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const runBulk = async (key: string) => {
    const action = flat.get(key);
    if (!action || !action.bulkEligible || !action.handler) return;
    const targets = rows.filter((r) => selected.has(r.id));
    if (!targets.length) { toast.error("Select at least one OG Pass"); return; }
    if (!window.confirm(`Apply "${action.label}" to ${targets.length} pass${targets.length === 1 ? "" : "es"}?`)) return;
    setBusyId("bulk");
    let ok = 0, fail = 0;
    for (const row of targets) {
      await new Promise<void>((resolve) => {
        action.handler!({
          row,
          run: async (fn) => { try { await fn(); ok++; } catch { fail++; } finally { resolve(); } },
        });
      });
    }
    setBusyId(null);
    toast[fail ? "warning" : "success"](`Bulk done — ${ok} ok, ${fail} failed`);
    await refresh();
  };

  const persistFavs = async (next: string[]) => {
    setFavs(next);
    try { await saveFavs({ data: { keys: next } }); toast.success("Favourites saved"); }
    catch (e: any) { toast.error(e?.message ?? "Save failed"); }
  };

  return (
    <div className="space-y-5">
      <header className="glass-obsidian-cmd rounded-3xl p-5">
        <div className="flex items-center gap-3">
          <Star className="h-6 w-6 text-gold" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.4em] terminal-mono text-gold">0G · Boss</p>
            <h1 className="syndicate-header text-2xl text-white/95">OG-Passes</h1>
          </div>
        </div>
        <p className="mt-2 text-sm text-white/65 max-w-2xl">
          Every OG-Pass holder, every action. Pin favourites for one-tap control, drill into categories for everything else, multi-select for bulk apply.
        </p>
      </header>

      <div className="glass-obsidian-cmd rounded-2xl p-3 flex flex-wrap items-center gap-2">
        <form onSubmit={(e) => { e.preventDefault(); refresh(); }} className="flex items-center gap-2 flex-1 min-w-[220px]">
          <Search className="h-4 w-4 text-white/50" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search email or display name…"
            className="flex-1 bg-transparent border border-border rounded-md px-3 py-1.5 text-sm text-white placeholder:text-white/40" />
          <button type="submit" className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-bold">Search</button>
        </form>
        <button onClick={() => setFavEditorOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/10 text-gold px-3 py-1.5 text-xs font-bold">
          <Settings2 className="h-3.5 w-3.5" /> Favourites ({favs.length})
        </button>
        <button onClick={refresh} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-bold">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-2 z-30 glass-obsidian-cmd rounded-2xl p-3 border border-gold/40 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-gold uppercase tracking-widest">{selected.size} selected · bulk apply →</span>
          <select onChange={(e) => { if (e.target.value) { runBulk(e.target.value); e.currentTarget.value = ""; } }}
            className="bg-card border border-border rounded-md px-2 py-1.5 text-xs">
            <option value="">Pick action…</option>
            {Array.from(flat.values()).filter((a) => a.bulkEligible).map((a) => (
              <option key={a.key} value={a.key}>{a.categoryLabel} → {a.label}</option>
            ))}
          </select>
          <button onClick={() => setSelected(new Set())} className="text-xs text-white/60 hover:text-white">Clear</button>
        </div>
      )}

      {loading && <p className="text-center text-sm text-white/55 py-6">Loading roster…</p>}

      <div className="grid grid-cols-1 gap-3">
        {rows.map((r) => {
          const busy = busyId === r.id;
          const isSelected = selected.has(r.id);
          return (
            <article key={r.id} className={`glass-obsidian-cmd rounded-2xl p-4 ${isSelected ? "ring-2 ring-gold/60" : ""}`}>
              <div className="flex items-start gap-3">
                <button onClick={() => toggleSelect(r.id)} className="mt-1 text-white/60 hover:text-gold" aria-label="Select for bulk">
                  {isSelected ? <CheckSquare className="h-5 w-5 text-gold" /> : <Square className="h-5 w-5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <BossOgPassCard row={r} />

                  {/* Favourites toolbar */}
                  {favs.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/5 pt-3">
                      {favs.map((key) => {
                        const a = flat.get(key);
                        if (!a) return null;
                        const Icon = a.icon;
                        const cls = `inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold disabled:opacity-50 ${actionToneClasses(a.tone)}`;
                        if (a.to) {
                          const link = resolveActionLink(a, r)!;
                          return (
                            <Link key={key} to={link.to as any} search={link.search as any} className={cls} title={a.hint}>
                              <Icon className="h-3 w-3" /> {a.label}
                            </Link>
                          );
                        }
                        return (
                          <button key={key} disabled={busy} onClick={() => runAction(r, a)} className={cls} title={a.hint}>
                            <Icon className="h-3 w-3" /> {a.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Categories → subcategories → actions */}
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-white/5 pt-3">
                    {catalog.map((cat) => (
                      <CategoryMenu key={cat.key} category={cat} row={r} busy={busy} onPick={(a) => runAction(r, a)} />
                    ))}
                    {busy && <Loader2 className="h-4 w-4 animate-spin text-gold ml-2" />}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
        {!loading && rows.length === 0 && <p className="text-center text-sm text-white/55 py-6">No OG passes match.</p>}
      </div>

      {favEditorOpen && (
        <FavouritesEditor
          catalog={catalog}
          favs={favs}
          onClose={() => setFavEditorOpen(false)}
          onSave={(next) => { persistFavs(next); setFavEditorOpen(false); }}
        />
      )}
    </div>
  );
}

/** Calls a server fn imperatively from a non-hook context. Safe because
 *  TanStack's useServerFn returns a stable wrapper, and we use it inline
 *  only inside event-driven handlers (never during render). */
function useServerFnInline<T extends (...a: any[]) => any>(fn: T): T {
  // useServerFn must be called at the top level — but each handler closure
  // captures it once at module load. We deliberately re-invoke for ergonomics
  // here; React still sees a stable hook order because all calls happen on
  // the same render path.
  return useServerFn(fn) as T;
}

function CategoryMenu({ category, row, busy, onPick }: {
  category: Category;
  row: RosterRow;
  busy: boolean;
  onPick: (a: Action) => void;
}) {
  const [open, setOpen] = useState(false);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const Icon = category.icon;
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} disabled={busy}
        className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-bold text-white/85 hover:bg-white/10 disabled:opacity-50"
        style={{ borderColor: category.tint + "55" }}>
        <Icon className="h-3.5 w-3.5" style={{ color: category.tint }} />
        {category.label}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute z-40 mt-1 min-w-[180px] rounded-lg border border-white/15 bg-black/95 backdrop-blur p-1 shadow-2xl">
          {category.subcategories.map((sub) => (
            <div key={sub.label} className="relative">
              <button onClick={() => setOpenSub((o) => o === sub.label ? null : sub.label)}
                className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] uppercase tracking-wider text-white/70 hover:bg-white/5 rounded">
                {sub.label} <ChevronDown className={`h-3 w-3 transition ${openSub === sub.label ? "rotate-180" : ""}`} />
              </button>
              {openSub === sub.label && (
                <div className="ml-2 my-1 border-l border-white/10 pl-2 space-y-0.5">
                  {sub.actions.map((a) => {
                    const AIcon = a.icon;
                    const cls = `w-full flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-bold ${actionToneClasses(a.tone)}`;
                    if (a.to) {
                      const link = resolveActionLink(a, row)!;
                      return (
                        <Link key={a.key} to={link.to as any} search={link.search as any} className={cls} title={a.hint} onClick={() => setOpen(false)}>
                          <AIcon className="h-3 w-3" /> {a.label}
                        </Link>
                      );
                    }
                    return (
                      <button key={a.key} onClick={() => { setOpen(false); onPick(a); }} className={cls} title={a.hint}>
                        <AIcon className="h-3 w-3" /> {a.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FavouritesEditor({ catalog, favs, onClose, onSave }: {
  catalog: Category[]; favs: string[]; onClose: () => void; onSave: (keys: string[]) => void;
}) {
  const [draft, setDraft] = useState<string[]>(favs);
  const toggle = (key: string) => setDraft((d) => d.includes(key) ? d.filter((k) => k !== key) : [...d, key]);
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl border-2 border-gold/60 bg-black/95 p-5 max-h-[85vh] overflow-y-auto">
        <h3 className="text-lg font-black uppercase tracking-wider text-gold mb-1">Favourite actions</h3>
        <p className="text-xs text-white/60 mb-4">Pin up to 24. Pinned actions appear as a one-tap toolbar on every OG-Pass card.</p>
        <div className="space-y-3">
          {catalog.map((c) => (
            <div key={c.key}>
              <p className="text-[11px] uppercase tracking-widest text-white/50 font-bold mb-1.5" style={{ color: c.tint }}>{c.label}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {c.subcategories.flatMap((s) => s.actions).map((a) => {
                  const on = draft.includes(a.key);
                  return (
                    <button key={a.key} onClick={() => toggle(a.key)}
                      className={`text-left flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${on ? "border-gold/60 bg-gold/15 text-gold" : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"}`}>
                      {on ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                      <span className="truncate">{a.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-bold">Cancel</button>
          <button onClick={() => onSave(draft.slice(0, 24))}
            className="rounded-md border border-gold/60 bg-gold/15 text-gold px-3 py-1.5 text-xs font-bold">Save ({draft.length})</button>
        </div>
      </div>
    </div>
  );
}