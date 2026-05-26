import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Users, Boxes, Cpu, Activity, Search, Coins, ShieldOff, ShieldCheck,
  Send, Power, PowerOff, KeyRound, ShieldAlert, RefreshCw, Loader2, X,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { requireBoss } from "@/lib/route-guards";
import { supabase } from "@/integrations/supabase/client";
import {
  listRoster, adjustCredits, setBanned, setHubAccess, type RosterRow,
} from "@/lib/boss-users.functions";
import { bossSetPortalPublished } from "@/lib/boss-admin-misc.functions";
import { sendTelegramReply } from "@/lib/telegram-inbox.functions";
import { listSecretsInventory, type SecretsInventorySection } from "@/lib/secrets-inventory.functions";
import { BossSpendPanel } from "@/components/BossSpendPanel";
import { BossTodoNotepad } from "@/components/BossTodoNotepad";
import { BossChatPanel } from "@/components/BossChatPanel";
import { BossStreamServerUrlCard } from "@/components/BossStreamServerUrlCard";
import { MasterSwearToggle } from "@/components/MasterSwearToggle";

export const Route = createFileRoute("/boss/command-center")({
  beforeLoad: requireBoss,
  head: () => ({
    meta: [
      { title: "Command Center · Boss" },
      { name: "description", content: "Unified Boss mega dashboard: users, portals, AI/system, telemetry." },
    ],
  }),
  component: CommandCenterPage,
});

function CommandCenterPage() {
  return (
    <div className="py-6">
      <header className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gold">
          Mega Command Center
        </h1>
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mt-1">
          Single surface · users · portals · ai · telemetry
        </p>
      </header>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full bg-background/60 border border-gold/20 rounded-xl p-1 mb-5">
          <TabsTrigger value="users" className="data-[state=active]:bg-gold/15 data-[state=active]:text-gold gap-1.5">
            <Users className="h-3.5 w-3.5" /> Users & Comms
          </TabsTrigger>
          <TabsTrigger value="portals" className="data-[state=active]:bg-gold/15 data-[state=active]:text-gold gap-1.5">
            <Boxes className="h-3.5 w-3.5" /> Portals & Content
          </TabsTrigger>
          <TabsTrigger value="ai" className="data-[state=active]:bg-gold/15 data-[state=active]:text-gold gap-1.5">
            <Cpu className="h-3.5 w-3.5" /> AI & System
          </TabsTrigger>
          <TabsTrigger value="ops" className="data-[state=active]:bg-gold/15 data-[state=active]:text-gold gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Telemetry & Ops
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="portals"><PortalsTab /></TabsContent>
        <TabsContent value="ai"><AiSystemTab /></TabsContent>
        <TabsContent value="ops"><OpsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ─────────────────────────── Tab 1: Users & Comms ─────────────────────────── */

function UsersTab() {
  const listFn = useServerFn(listRoster);
  const banFn = useServerFn(setBanned);
  const hubFn = useServerFn(setHubAccess);
  const creditsFn = useServerFn(adjustCredits);

  const [rows, setRows] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tgFor, setTgFor] = useState<RosterRow | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const r: any = await listFn({ data: { search, limit: 50 } });
      setRows(r?.rows ?? []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load roster");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const onSearch = (e: React.FormEvent) => { e.preventDefault(); reload(); };

  const toggleHub = async (r: RosterRow) => {
    setBusyId(r.id);
    try {
      await hubFn({ data: { userId: r.id, value: !r.hub_access } });
      setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, hub_access: !r.hub_access } : x));
      toast.success(`Hub access ${!r.hub_access ? "granted" : "revoked"}`);
    } catch (e: any) { toast.error(e?.message || "Failed"); }
    finally { setBusyId(null); }
  };

  const toggleBan = async (r: RosterRow) => {
    setBusyId(r.id);
    try {
      await banFn({ data: { userId: r.id, banned: !r.banned, reason: r.banned ? null : "Boss action" } });
      setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, banned: !r.banned } : x));
      toast.success(!r.banned ? "Banned" : "Unbanned");
    } catch (e: any) { toast.error(e?.message || "Failed"); }
    finally { setBusyId(null); }
  };

  const adjust = async (r: RosterRow, delta: number) => {
    setBusyId(r.id);
    try {
      await creditsFn({ data: { userId: r.id, delta, reason: delta > 0 ? "Boss gift" : "Boss deduct" } });
      setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, credits: Math.max(0, (x.credits || 0) + delta) } : x));
      toast.success(`${delta > 0 ? "+" : ""}${delta} coins`);
    } catch (e: any) { toast.error(e?.message || "Failed"); }
    finally { setBusyId(null); }
  };

  return (
    <div className="rounded-2xl border border-gold/20 bg-background/40 p-4 sm:p-5">
      <form onSubmit={onSearch} className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or name…"
            className="pl-9 bg-background/60"
          />
        </div>
        <Button type="submit" variant="outline" className="border-gold/30">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Search
        </Button>
      </form>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading roster…</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No users found.</p>
      ) : (
        <div className="divide-y divide-white/5 -mx-2">
          {rows.map((r) => {
            const busy = busyId === r.id;
            return (
              <div key={r.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 px-2 py-3 items-center hover:bg-white/[0.02]">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{r.display_name || r.email}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {r.email} · <span className="uppercase tracking-widest">{r.rank}</span>
                    {r.banned && <span className="ml-2 text-destructive">· BANNED</span>}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 justify-end">
                  <ToggleChip
                    on={!!r.hub_access}
                    label="Hub"
                    onClick={() => toggleHub(r)}
                    disabled={busy}
                    activeTint="cyan"
                  />
                  <ToggleChip
                    on={r.banned}
                    label={r.banned ? "Banned" : "Active"}
                    onClick={() => toggleBan(r)}
                    disabled={busy}
                    activeTint="red"
                  />
                  <div className="inline-flex items-center gap-1 rounded-md border border-gold/30 bg-gold/5 px-2 py-1">
                    <Coins className="h-3 w-3 text-gold" />
                    <span className="font-mono text-xs font-bold text-gold tabular-nums w-12 text-right">{r.credits ?? 0}</span>
                    <button
                      type="button"
                      onClick={() => adjust(r, 100)}
                      disabled={busy}
                      className="ml-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400 hover:text-emerald-300 disabled:opacity-40"
                    >+100</button>
                    <button
                      type="button"
                      onClick={() => adjust(r, -100)}
                      disabled={busy}
                      className="text-[10px] font-bold uppercase tracking-widest text-destructive hover:text-destructive/80 disabled:opacity-40"
                    >−100</button>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-cyan-400/40 text-cyan-300 hover:bg-cyan-400/10 h-8"
                    onClick={() => setTgFor(r)}
                  >
                    <Send className="h-3 w-3 mr-1" /> Telegram
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tgFor && <TelegramDialog user={tgFor} onClose={() => setTgFor(null)} />}
    </div>
  );
}

function ToggleChip({
  on, label, onClick, disabled, activeTint,
}: { on: boolean; label: string; onClick: () => void; disabled?: boolean; activeTint: "cyan" | "red" }) {
  const tint =
    on && activeTint === "cyan" ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300"
    : on && activeTint === "red" ? "border-destructive/50 bg-destructive/10 text-destructive"
    : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition disabled:opacity-50 ${tint}`}
    >
      {on ? <ShieldCheck className="h-3 w-3" /> : <ShieldOff className="h-3 w-3" />}
      {label}
    </button>
  );
}

function TelegramDialog({ user, onClose }: { user: RosterRow; onClose: () => void }) {
  const sendFn = useServerFn(sendTelegramReply);
  const [chatId, setChatId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("telegram_user_links")
        .select("chat_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setChatId((data as any)?.chat_id ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user.id]);

  const send = async () => {
    if (!chatId || !text.trim()) return;
    setBusy(true);
    try {
      await sendFn({ data: { chatId: Number(chatId), text: text.trim() } });
      toast.success("Telegram message sent");
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Send failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-gold/30 bg-background p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm uppercase tracking-widest text-gold">Send Telegram</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          To: <span className="text-foreground font-semibold">{user.display_name || user.email}</span>
        </p>
        {loading ? (
          <p className="text-xs text-muted-foreground py-6 text-center">Looking up Telegram link…</p>
        ) : !chatId ? (
          <p className="text-xs text-destructive py-6 text-center">User has not connected Telegram.</p>
        ) : (
          <>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your message…"
              rows={4}
              className="bg-background/60 mb-3"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={send} disabled={busy || !text.trim()} className="bg-gold text-background hover:bg-gold/90">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                Send
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── Tab 2: Portals & Content ─────────────────────────── */

type PortalRow = { id: string; slug: string; name: string; kind: string; published: boolean; view_count: number };

function PortalsTab() {
  const publishFn = useServerFn(bossSetPortalPublished);
  const [rows, setRows] = useState<PortalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const reload = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("portals")
      .select("id, slug, name, kind, published, view_count")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setRows((data ?? []) as PortalRow[]);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const togglePublished = async (r: PortalRow) => {
    setBusyId(r.id);
    try {
      await publishFn({ data: { portal_id: r.id, published: !r.published } });
      setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, published: !r.published } : x));
      toast.success(!r.published ? "Published" : "Unpublished");
    } catch (e: any) { toast.error(e?.message || "Failed"); }
    finally { setBusyId(null); }
  };

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q) || r.kind.toLowerCase().includes(q));
  }, [rows, filter]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
      <div className="rounded-2xl border border-gold/20 bg-background/40 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gold inline-flex items-center gap-2">
            <Boxes className="h-4 w-4" /> Portals · {rows.length}
          </h2>
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            className="max-w-[200px] bg-background/60 h-8 text-xs"
          />
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading portals…</p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No portals.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{r.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    <span className="uppercase tracking-widest">{r.kind}</span> · /{r.slug} · {r.view_count} views
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => togglePublished(r)}
                  disabled={busyId === r.id}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition disabled:opacity-50 ${
                    r.published
                      ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20"
                      : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r.published ? <Power className="h-3 w-3" /> : <PowerOff className="h-3 w-3" />}
                  {r.published ? "Live" : "Hidden"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <DomainDenylistInline />
    </div>
  );
}

function DomainDenylistInline() {
  type Row = { id: string; domain: string; note: string; created_at: string };
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("domain_denylist")
      .select("id, domain, note, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const d = domain.trim().toLowerCase();
    if (!d) return;
    setBusy(true);
    const { error } = await supabase.from("domain_denylist").insert({ domain: d, note: note.trim() });
    setBusy(false);
    if (error) return toast.error(error.message);
    setDomain(""); setNote("");
    toast.success("Blocked");
    reload();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("domain_denylist").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((rs) => rs.filter((r) => r.id !== id));
    toast.success("Removed");
  };

  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/[0.03] p-4 sm:p-5">
      <h2 className="text-sm font-bold uppercase tracking-widest text-destructive inline-flex items-center gap-2 mb-3">
        <ShieldAlert className="h-4 w-4" /> Domain Denylist
      </h2>

      <form onSubmit={add} className="space-y-2 mb-4">
        <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" className="bg-background/60 h-9 text-xs font-mono" />
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (optional)" className="bg-background/60 h-9 text-xs" />
        <Button type="submit" disabled={busy || !domain.trim()} className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground h-8 text-xs uppercase tracking-widest">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Block"}
        </Button>
      </form>

      {loading ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">No blocked domains.</p>
      ) : (
        <ul className="space-y-1 max-h-72 overflow-y-auto">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-white/5 bg-background/30 px-2 py-1.5">
              <div className="min-w-0">
                <p className="font-mono text-xs truncate">{r.domain}</p>
                {r.note && <p className="text-[10px] text-muted-foreground truncate">{r.note}</p>}
              </div>
              <button onClick={() => remove(r.id)} className="text-destructive hover:text-destructive/80 shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─────────────────────────── Tab 3: AI & System ─────────────────────────── */

function AiSystemTab() {
  const listFn = useServerFn(listSecretsInventory);
  const [sections, setSections] = useState<SecretsInventorySection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r: any = await listFn();
        setSections(r?.sections ?? []);
      } catch (e: any) { toast.error(e?.message || "Failed"); }
      finally { setLoading(false); }
    })();
  }, [listFn]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gold/20 bg-background/40 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gold inline-flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> AI & API Status
          </h2>
          <MasterSwearToggle />
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading inventory…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sections.flatMap((s) =>
              s.entries.map((e) => (
                <div
                  key={e.name}
                  className="rounded-lg border border-white/10 bg-background/40 px-3 py-3"
                  style={{ boxShadow: `inset 0 0 0 1px ${s.tint}22` }}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-[11px] font-bold truncate" style={{ color: s.tint }}>{e.name}</span>
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_currentColor]" aria-label="configured" />
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">{e.purpose}</p>
                  {e.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {e.tags.map((t) => (
                        <span key={t} className="text-[9px] uppercase tracking-widest text-white/40 border border-white/10 rounded px-1">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <BossStreamServerUrlCard />
    </div>
  );
}

/* ─────────────────────────── Tab 4: Telemetry & Ops ─────────────────────────── */

function OpsTab() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
      <div className="space-y-5 min-w-0">
        <BossSpendPanel />
        <BossTodoNotepad />
      </div>
      <div className="rounded-2xl border border-gold/20 bg-background/40 p-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gold mb-3">Reality Check Chat</h2>
        <BossChatPanel />
      </div>
    </div>
  );
}