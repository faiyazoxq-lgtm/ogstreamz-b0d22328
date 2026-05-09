import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Crown, ArrowLeft, ShieldCheck, Flame, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getCivility, setCivilityDefault, listSwearItems } from "@/lib/civility.functions";
import { setSwearChat } from "@/lib/swear-chat.functions";

export const Route = createFileRoute("/boss/civility")({
  head: () => ({
    meta: [
      { title: "Civility Controls · Boss Portal" },
      { name: "description", content: "Toggle the Guttermouth swear-chat per portal, battle, or custom hub — and set the global default." },
    ],
  }),
  component: CivilityPage,
});

type Item = {
  table: "portals" | "battles" | "custom_hubs";
  id: string;
  name: string;
  subtitle: string;
  swear_chat_enabled: boolean;
  created_at: string;
};

const TABLE_LABEL: Record<Item["table"], string> = {
  portals: "Portal",
  battles: "Battle",
  custom_hubs: "Custom Hub",
};
const TABLE_TINT: Record<Item["table"], string> = {
  portals: "#3ad6ff",
  battles: "#ff2e55",
  custom_hubs: "#a78bfa",
};

function CivilityPage() {
  const { user, profile, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const isBoss = profile?.rank === "boss" || isAdmin;

  const fetchCivility = useServerFn(getCivility);
  const saveCivility = useServerFn(setCivilityDefault);
  const fetchItems = useServerFn(listSwearItems);
  const toggleItemFn = useServerFn(setSwearChat);

  const [defaultOn, setDefaultOn] = useState<boolean | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [filter, setFilter] = useState<"all" | Item["table"]>("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || !isBoss) { navigate({ to: "/" }); return; }
    (async () => {
      try {
        const [c, l] = await Promise.all([fetchCivility(), fetchItems()]);
        setDefaultOn(c.swear_default);
        setItems(l.items as Item[]);
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to load civility settings");
      }
    })();
  }, [loading, user, isBoss, navigate, fetchCivility, fetchItems]);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((i) => {
      if (filter !== "all" && i.table !== filter) return false;
      if (q && !`${i.name} ${i.subtitle}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [items, filter, q]);

  const stats = useMemo(() => {
    const total = items?.length ?? 0;
    const on = items?.filter((i) => i.swear_chat_enabled).length ?? 0;
    return { total, on, off: total - on };
  }, [items]);

  const setDefault = async (enabled: boolean, applyToAll: boolean) => {
    setBusy("default");
    try {
      const res = await saveCivility({ data: { enabled, applyToAll } });
      setDefaultOn(res.swear_default);
      if (applyToAll && items) {
        setItems(items.map((i) => ({ ...i, swear_chat_enabled: enabled })));
        toast.success(enabled
          ? `Guttermouth ARMED across ${res.updated || 0} item(s)`
          : `Civil mode applied to ${res.updated || 0} item(s)`);
      } else {
        toast.success(enabled ? "New items will spawn with swear chat ON" : "New items will spawn CIVIL");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setBusy(null);
    }
  };

  const toggleItem = async (i: Item) => {
    const next = !i.swear_chat_enabled;
    setBusy(`${i.table}:${i.id}`);
    // optimistic
    setItems((prev) => prev?.map((x) => (x.id === i.id && x.table === i.table ? { ...x, swear_chat_enabled: next } : x)) ?? prev);
    try {
      await toggleItemFn({ data: { table: i.table, id: i.id, enabled: next } });
      toast.success(`${i.name}: swear chat ${next ? "ARMED" : "muzzled"}`);
    } catch (e: any) {
      // revert
      setItems((prev) => prev?.map((x) => (x.id === i.id && x.table === i.table ? { ...x, swear_chat_enabled: !next } : x)) ?? prev);
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(null);
    }
  };

  if (loading || !isBoss) {
    return <main className="px-5 py-20 text-center text-muted-foreground">Verifying clearance…</main>;
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 pt-6 pb-28 md:pb-12 space-y-6">
      <Link to="/boss" className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Boss portal
      </Link>

      <header className="glass-obsidian-cmd rounded-3xl p-5 md:p-6">
        <div className="flex items-center gap-3">
          <Crown className="h-6 w-6" style={{ color: "#ffd166" }} />
          <div>
            <p className="text-[10px] uppercase tracking-[0.4em] terminal-mono" style={{ color: "#ffd166" }}>
              0G · Civility Controls
            </p>
            <h1 className="syndicate-header text-2xl md:text-3xl text-white/95">Guttermouth Master Switch</h1>
          </div>
        </div>
        <p className="mt-3 text-sm text-white/65 max-w-2xl">
          Decide whether the foul-mouthed Guttermouth swear-chat is on by default for new portals, battles, and custom hubs — and flip individual items below.
        </p>

        {/* Master toggle */}
        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto] items-center rounded-2xl border border-white/10 bg-black/40 p-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/55">Default for new items</p>
            <p className="mt-1 text-sm text-white/85">
              {defaultOn == null
                ? "Loading…"
                : defaultOn
                  ? <><Flame className="inline h-3.5 w-3.5 mb-0.5" style={{ color: "#ff5577" }} /> <b>Guttermouth ARMED</b> — new items spawn with swear chat on.</>
                  : <><ShieldCheck className="inline h-3.5 w-3.5 mb-0.5" style={{ color: "#3ad6ff" }} /> <b>Civil mode</b> — new items spawn muzzled.</>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              onClick={() => setDefault(false, false)}
              disabled={busy === "default" || defaultOn === false}
              className="inline-flex items-center gap-1.5 rounded-md border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-[11px] uppercase tracking-[0.2em] font-bold text-cyan-200 disabled:opacity-50"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Set default: Civil
            </button>
            <button
              onClick={() => setDefault(true, false)}
              disabled={busy === "default" || defaultOn === true}
              className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] uppercase tracking-[0.2em] font-bold text-rose-200 disabled:opacity-50"
            >
              <Flame className="h-3.5 w-3.5" /> Set default: Guttermouth
            </button>
          </div>
        </div>

        {/* Bulk apply */}
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <button
            onClick={() => setDefault(false, true)}
            disabled={busy === "default"}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-white/10 bg-black/40 px-3 py-2 text-[11px] uppercase tracking-[0.2em] font-bold hover:border-cyan-400/60 disabled:opacity-50"
          >
            {busy === "default" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" style={{ color: "#3ad6ff" }} />}
            Keep things civil — muzzle EVERYTHING
          </button>
          <button
            onClick={() => setDefault(true, true)}
            disabled={busy === "default"}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-white/10 bg-black/40 px-3 py-2 text-[11px] uppercase tracking-[0.2em] font-bold hover:border-rose-500/60 disabled:opacity-50"
          >
            {busy === "default" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flame className="h-3.5 w-3.5" style={{ color: "#ff5577" }} />}
            Unleash Guttermouth on EVERYTHING
          </button>
        </div>
      </header>

      {/* Per-item controls */}
      <section className="glass-obsidian-cmd rounded-3xl p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="syndicate-header text-lg text-white/95">Per-item Toggles</h2>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/55 mt-1">
              {stats.total} total · {stats.on} armed · {stats.off} muzzled
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="pl-8 pr-3 py-1.5 rounded-md bg-black/40 border border-white/10 text-xs w-44 focus:outline-none focus:border-cyan-400/60"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {(["all","portals","battles","custom_hubs"] as const).map((k) => {
            const active = filter === k;
            const tint = k === "all" ? "#ffd166" : TABLE_TINT[k];
            const label = k === "all" ? "All" : TABLE_LABEL[k] + "s";
            return (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] font-semibold border transition"
                style={{
                  borderColor: active ? tint : "rgba(255,255,255,0.12)",
                  background: active ? "rgba(255,255,255,0.05)" : "transparent",
                  color: active ? tint : "rgba(255,255,255,0.7)",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 divide-y divide-white/5">
          {items === null ? (
            <p className="py-8 text-center text-sm text-white/55">Loading items…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/55">Nothing here.</p>
          ) : (
            filtered.map((i) => {
              const tint = TABLE_TINT[i.table];
              const id = `${i.table}:${i.id}`;
              const isBusy = busy === id;
              return (
                <div key={id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] uppercase tracking-widest font-bold"
                        style={{ background: `${tint}1f`, color: tint, border: `1px solid ${tint}55` }}
                      >
                        {TABLE_LABEL[i.table]}
                      </span>
                      <span className="truncate text-sm text-white/90 font-semibold">{i.name}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-white/50">{i.subtitle}</p>
                  </div>
                  <button
                    onClick={() => toggleItem(i)}
                    disabled={isBusy}
                    role="switch"
                    aria-checked={i.swear_chat_enabled}
                    aria-label={`Swear chat for ${i.name}`}
                    className="relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition disabled:opacity-50"
                    style={{
                      background: i.swear_chat_enabled ? "rgba(255,46,85,0.35)" : "rgba(58,214,255,0.25)",
                      border: `1px solid ${i.swear_chat_enabled ? "#ff2e55" : "#3ad6ff"}`,
                    }}
                  >
                    <span
                      className="inline-block h-5 w-5 transform rounded-full bg-white transition"
                      style={{ transform: `translateX(${i.swear_chat_enabled ? 30 : 4}px)` }}
                    />
                    <span className="sr-only">{i.swear_chat_enabled ? "Swear chat on" : "Swear chat off"}</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}