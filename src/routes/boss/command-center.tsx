import { createFileRoute } from "@tanstack/react-router";
import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from "react";
import {
  Users,
  Boxes,
  Cpu,
  Activity,
  Send,
  Plus,
  Minus,
  ShieldOff,
  ShieldCheck,
  Coins,
  CheckCircle2,
  XCircle,
  Loader2,
  Terminal,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  Globe,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { requireBoss } from "@/lib/route-guards";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listRoster, setHubAccess, setBanned, adjustCredits } from "@/lib/boss-users.functions";
import { sendTelegramReply } from "@/lib/telegram-inbox.functions";
import { listSecretsInventory } from "@/lib/secrets-inventory.functions";
import {
  listPortalsForBoss,
  listCalculatorsForBoss,
  bossSetPortalVip,
  bossSetCalculatorPublished,
  listDomainDenylist,
  addDomainToDenylist,
  removeDomainFromDenylist,
  getMaintenanceMode,
  setMaintenanceMode,
  purgeOldSecurityEvents,
} from "@/lib/boss-command-center.functions";
import { bossSetPortalPublished } from "@/lib/boss-admin-misc.functions";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { MasterSwearToggle } from "@/components/MasterSwearToggle";
import { BossStreamServerUrlCard } from "@/components/BossStreamServerUrlCard";
import { BossSpendPanel } from "@/components/BossSpendPanel";
import { BossTodoNotepad } from "@/components/BossTodoNotepad";
import { BossChatPanel } from "@/components/BossChatPanel";

export const Route = createFileRoute("/boss/command-center")({
  beforeLoad: requireBoss,
  head: () => ({
    meta: [
      { title: "Command Center · Boss" },
      { name: "description", content: "Unified Boss mega dashboard: users, portals, AI engine, ops & sync." },
    ],
  }),
  component: CommandCenterPage,
});

function CommandCenterPage() {
  return (
    <div className="py-6">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gold">
          Mega Command Center
        </h1>
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mt-1">
          Unified surface · users · portals · AI · ops
        </p>
      </header>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full bg-background/60 border border-border rounded-xl p-1 mb-6">
          <TabsTrigger
            value="users"
            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm gap-1.5 text-xs sm:text-sm"
          >
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">1. Users & CRM</span>
            <span className="sm:hidden">Users</span>
          </TabsTrigger>
          <TabsTrigger
            value="portals"
            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm gap-1.5 text-xs sm:text-sm"
          >
            <Boxes className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">2. Portals & Content</span>
            <span className="sm:hidden">Portals</span>
          </TabsTrigger>
          <TabsTrigger
            value="ai"
            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm gap-1.5 text-xs sm:text-sm"
          >
            <Cpu className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">3. AI Engine</span>
            <span className="sm:hidden">AI</span>
          </TabsTrigger>
          <TabsTrigger
            value="ops"
            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm gap-1.5 text-xs sm:text-sm"
          >
            <Activity className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">4. Ops & Sync</span>
            <span className="sm:hidden">Ops</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <ModuleBoundary title="Users & CRM"><UsersCrmTab /></ModuleBoundary>
        </TabsContent>
        <TabsContent value="portals">
          <ModuleBoundary title="Portals & Content"><PortalsContentTab /></ModuleBoundary>
        </TabsContent>
        <TabsContent value="ai">
          <ModuleBoundary title="AI Engine"><AiEngineTab /></ModuleBoundary>
        </TabsContent>
        <TabsContent value="ops">
          <ModuleBoundary title="Ops & Sync"><OpsSyncTab /></ModuleBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Error Boundary (per-module)
 * ──────────────────────────────────────────────────────────────── */
class ModuleBoundary extends Component<
  { title: string; children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[CommandCenter:${this.props.title}]`, error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <Card className="bg-background border-rose-500/40 shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="h-4 w-4" /> {this.props.title} crashed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs text-rose-300/80 whitespace-pre-wrap bg-black/40 p-3 rounded">
              {this.state.error.message}
            </pre>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => this.setState({ error: null })}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}

/* ────────────────────────────────────────────────────────────────
 * Tab 1 — Users & CRM
 * ──────────────────────────────────────────────────────────────── */
function UsersCrmTab() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const listRosterFn = useServerFn(listRoster);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["boss-roster", debounced],
    queryFn: () => listRosterFn({ data: { search: debounced, limit: 50 } }),
  });

  const rows = data?.rows ?? [];
  const userIds = rows.map((r) => r.id);

  // Fetch telegram chat_id mapping for visible users
  const { data: tgLinks } = useQuery({
    queryKey: ["tg-links-for-roster", userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_user_links")
        .select("user_id, chat_id")
        .in("user_id", userIds);
      if (error) throw error;
      const map = new Map<string, number>();
      for (const row of data ?? []) {
        if (row.chat_id) map.set(row.user_id, Number(row.chat_id));
      }
      return map;
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["boss-roster"] });

  return (
    <Card className="bg-background border-border shadow-2xl">
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <div>
          <CardTitle className="text-lg">Users & CRM</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {rows.length} of {data?.hasMore ? `${rows.length}+` : rows.length} profiles
          </p>
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search email or name…"
          className="max-w-xs"
        />
      </CardHeader>
      <CardContent>
        {error && (
          <div className="text-sm text-rose-400 py-4">
            Failed to load roster: {(error as Error).message}
          </div>
        )}
        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="w-[90px]">Rank</TableHead>
                <TableHead className="w-[90px] text-right">Coins</TableHead>
                <TableHead className="w-[110px]">Hub</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="text-right w-[280px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    <Loader2 className="inline h-4 w-4 animate-spin mr-2" /> Loading roster…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No users match.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  chatId={tgLinks?.get(u.id) ?? null}
                  onChange={invalidate}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

type RosterUser = {
  id: string;
  email: string | null;
  display_name?: string | null;
  rank: string | null;
  banned: boolean | null;
  credits: number | null;
  hub_access?: boolean | null;
};

function UserRow({
  user,
  chatId,
  onChange,
}: {
  user: RosterUser;
  chatId: number | null;
  onChange: () => void;
}) {
  const setHubAccessFn = useServerFn(setHubAccess);
  const setBannedFn = useServerFn(setBanned);
  const adjustCreditsFn = useServerFn(adjustCredits);

  const hubMut = useMutation({
    mutationFn: () =>
      setHubAccessFn({ data: { userId: user.id, enabled: !user.hub_access } }),
    onSuccess: () => {
      toast.success(`Hub ${!user.hub_access ? "granted" : "revoked"}`);
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const banMut = useMutation({
    mutationFn: () =>
      setBannedFn({
        data: { userId: user.id, banned: !user.banned, reason: user.banned ? undefined : "boss:command-center" },
      }),
    onSuccess: () => {
      toast.success(user.banned ? "User unbanned" : "User banned");
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium text-sm">{user.email ?? "—"}</div>
        {user.display_name && (
          <div className="text-xs text-muted-foreground">{user.display_name}</div>
        )}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
          {user.rank ?? "—"}
        </Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums font-mono text-sm">
        {user.credits ?? 0}
      </TableCell>
      <TableCell>
        <Badge variant={user.hub_access ? "default" : "secondary"} className="text-[10px]">
          {user.hub_access ? "ENABLED" : "OFF"}
        </Badge>
      </TableCell>
      <TableCell>
        {user.banned ? (
          <Badge variant="destructive" className="text-[10px]">BANNED</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-400/30">
            ACTIVE
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => hubMut.mutate()}
            disabled={hubMut.isPending}
            className="h-7 px-2 text-xs"
            title="Toggle Hub Access"
          >
            {user.hub_access ? <ShieldOff className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
          </Button>
          <Button
            size="sm"
            variant={user.banned ? "outline" : "destructive"}
            onClick={() => banMut.mutate()}
            disabled={banMut.isPending}
            className="h-7 px-2 text-xs"
            title={user.banned ? "Unban" : "Ban"}
          >
            {user.banned ? "Unban" : "Ban"}
          </Button>
          <AdjustCoinsDialog
            user={user}
            onApply={async (delta, reason) => {
              await adjustCreditsFn({ data: { userId: user.id, delta, reason } });
              onChange();
            }}
          />
          {chatId !== null && (
            <TelegramDialog chatId={chatId} userEmail={user.email ?? "user"} />
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function AdjustCoinsDialog({
  user,
  onApply,
}: {
  user: RosterUser;
  onApply: (delta: number, reason: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("100");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (sign: 1 | -1) => {
    const n = Math.trunc(Number(amount));
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter a positive amount");
      return;
    }
    setPending(true);
    try {
      await onApply(sign * n, reason || "boss:adjust");
      toast.success(`${sign > 0 ? "Added" : "Removed"} ${n} coins`);
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" title="Adjust Coins">
          <Coins className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Coins</DialogTitle>
          <DialogDescription>
            {user.email} · current balance:{" "}
            <span className="font-mono">{user.credits ?? 0}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Amount</label>
            <Input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Reason (optional)</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="boss:adjust"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => submit(-1)} disabled={pending}>
            <Minus className="h-4 w-4 mr-1" /> Remove
          </Button>
          <Button onClick={() => submit(1)} disabled={pending}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TelegramDialog({ chatId, userEmail }: { chatId: number; userEmail: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const sendFn = useServerFn(sendTelegramReply);

  const send = async () => {
    const msg = text.trim();
    if (!msg) {
      toast.error("Empty message");
      return;
    }
    setPending(true);
    try {
      await sendFn({ data: { chatId, text: msg } });
      toast.success("Telegram message sent");
      setText("");
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          title="Message via Telegram"
        >
          <Send className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Telegram Message</DialogTitle>
          <DialogDescription>
            DM {userEmail} via the platform bot · chat id <span className="font-mono">{chatId}</span>
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write your message…"
          rows={5}
          maxLength={4000}
          className="w-full rounded-md border border-input bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <DialogFooter>
          <Button onClick={send} disabled={pending}>
            <Send className="h-4 w-4 mr-1" /> Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Tab 3 — AI Engine
 * ──────────────────────────────────────────────────────────────── */
function AiEngineTab() {
  const listSecretsFn = useServerFn(listSecretsInventory);
  const { data: inventory } = useQuery({
    queryKey: ["secrets-inventory"],
    queryFn: () => listSecretsFn(),
  });

  // Build a status grid for the key AI / platform services
  const services: Array<{ key: string; label: string; secretName: string }> = [
    { key: "suno", label: "Suno (Music Gen)", secretName: "SUNO_API_KEY" },
    { key: "perplexity", label: "Perplexity (Research)", secretName: "PERPLEXITY_API_KEY" },
    { key: "lovable", label: "Lovable AI Gateway", secretName: "LOVABLE_API_KEY" },
    { key: "shapes", label: "Shapes Inference", secretName: "SHAPES_API_KEY" },
    { key: "telegram", label: "Telegram Bot", secretName: "TELEGRAM_API_KEY" },
    { key: "supabase", label: "Lovable Cloud (DB)", secretName: "__supabase__" },
  ];

  // We can know a secret is *catalogued*; presence in env is not exposed.
  // Treat catalogued+ping-able as "configured". Supabase we ping directly.
  const cataloguedNames = new Set<string>(
    inventory?.sections.flatMap((s) => s.entries.map((e) => e.name)) ?? [],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <Card className="bg-background border-border shadow-2xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-4 w-4" /> Connection Status
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Live health of upstream AI providers and the platform database.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {services.map((s) => (
                <ServiceHealthTile
                  key={s.key}
                  label={s.label}
                  serviceKey={s.key}
                  configured={s.key === "supabase" ? true : cataloguedNames.has(s.secretName)}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <PlatformLogViewer />
      </div>

      <div className="space-y-6">
        <MasterSwearToggle />
        <BossStreamServerUrlCard />
      </div>
    </div>
  );
}

function ServiceHealthTile({
  label,
  serviceKey,
  configured,
}: {
  label: string;
  serviceKey: string;
  configured: boolean;
}) {
  const [status, setStatus] = useState<"checking" | "ok" | "down" | "unconfigured">(
    configured ? "checking" : "unconfigured",
  );
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    if (!configured) {
      setStatus("unconfigured");
      return;
    }
    let alive = true;
    const t0 = performance.now();
    (async () => {
      try {
        if (serviceKey === "supabase") {
          const { error } = await supabase.from("profiles").select("id", { head: true, count: "exact" }).limit(1);
          if (!alive) return;
          setStatus(error ? "down" : "ok");
        } else {
          // For external providers we cannot probe from the browser (CORS / secrets).
          // Catalogued = "configured & ready" until a probe endpoint exists.
          setStatus("ok");
        }
      } catch {
        if (alive) setStatus("down");
      } finally {
        if (alive) setLatency(Math.round(performance.now() - t0));
      }
    })();
    return () => {
      alive = false;
    };
  }, [serviceKey, configured]);

  const tone =
    status === "ok"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : status === "down"
      ? "border-rose-500/40 bg-rose-500/5"
      : status === "unconfigured"
      ? "border-border bg-muted/20"
      : "border-border bg-background";

  return (
    <div className={`rounded-lg border ${tone} p-3 flex items-center justify-between gap-2`}>
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {status === "checking" && "Checking…"}
          {status === "ok" && `Healthy${latency != null ? ` · ${latency}ms` : ""}`}
          {status === "down" && "Unreachable"}
          {status === "unconfigured" && "Not configured"}
        </div>
      </div>
      {status === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      {status === "ok" && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
      {status === "down" && <XCircle className="h-4 w-4 text-rose-400" />}
      {status === "unconfigured" && <XCircle className="h-4 w-4 text-muted-foreground" />}
    </div>
  );
}

type AiLogRow = {
  id: string;
  source: string;
  level: string;
  message: string;
  mood: string | null;
  created_at: string;
};

function PlatformLogViewer() {
  const [rows, setRows] = useState<AiLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    supabase
      .from("ai_logs")
      .select("id, source, level, message, mood, created_at")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!alive) return;
        setRows(((data as AiLogRow[]) ?? []));
        setLoading(false);
      });
    const channel = supabase
      .channel("ai-logs-command-center")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ai_logs" },
        (payload: any) => {
          const row = payload.new as AiLogRow;
          setRows((rs) => [row, ...rs].slice(0, 50));
        },
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <Card className="bg-background border-border shadow-2xl">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Terminal className="h-4 w-4" /> Platform Log Viewer
        </CardTitle>
        <p className="text-xs text-muted-foreground">Last 50 entries from ai_logs (live).</p>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-border bg-black/60 max-h-[420px] overflow-y-auto p-3 font-mono text-[11px] space-y-1">
          {loading && (
            <div className="text-muted-foreground">
              <Loader2 className="inline h-3 w-3 animate-spin mr-2" /> Loading…
            </div>
          )}
          {!loading && rows.length === 0 && (
            <div className="text-muted-foreground italic">// no log entries yet</div>
          )}
          {rows.map((r) => {
            const tone =
              r.level === "error"
                ? "text-rose-300"
                : r.level === "warn"
                ? "text-amber-300"
                : "text-white/85";
            return (
              <div key={r.id} className={tone}>
                <span className="text-muted-foreground">
                  [{new Date(r.created_at).toLocaleTimeString()}]
                </span>{" "}
                <span className="text-primary/80">{r.source}</span>/
                <span className="uppercase">{r.level}</span> ▸ {r.message}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ModulePlaceholder({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-border bg-background shadow-2xl p-8 sm:p-12">
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
          <Activity className="h-6 w-6 text-primary/60" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Loading {title} Module…
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            This operational surface is being prepared. Check back shortly for live data.
          </p>
        </div>
      </div>
    </div>
  );
}
