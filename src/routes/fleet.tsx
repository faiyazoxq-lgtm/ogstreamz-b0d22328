import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Radio, Megaphone, Zap, Moon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import {
  listFleet,
  spawnFleetBot,
  deleteFleetBot,
  setBotTier,
  setBotActive,
  setGlobalFrequency,
  broadcastFleetCommand,
} from "@/lib/fleet.functions";

export const Route = createFileRoute("/fleet")({
  head: () => ({
    meta: [
      { title: "Fleet Commander — 0G Syndicate" },
      { name: "description", content: "Spawn and command per-pair Telegram bots from a single Master console." },
    ],
  }),
  component: FleetPage,
});

function FleetPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const callList = useServerFn(listFleet);
  const callSpawn = useServerFn(spawnFleetBot);
  const callDelete = useServerFn(deleteFleetBot);
  const callTier = useServerFn(setBotTier);
  const callActive = useServerFn(setBotActive);
  const callFreq = useServerFn(setGlobalFrequency);
  const callBroadcast = useServerFn(broadcastFleetCommand);

  const { data, isLoading, error } = useQuery({
    queryKey: ["fleet"],
    queryFn: () => callList({}),
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const [pairName, setPairName] = useState("");
  const [pairLabel, setPairLabel] = useState("");
  const [token, setToken] = useState("");
  const [channel, setChannel] = useState("");
  const [bias, setBias] = useState<"good" | "bad" | "neutral">("neutral");
  const [broadcastMsg, setBroadcastMsg] = useState("");

  const spawn = useMutation({
    mutationFn: () =>
      callSpawn({
        data: {
          pair_name: pairName,
          pair_label: pairLabel,
          telegram_bot_token: token,
          channel_chat_id: channel,
          bias,
        },
      }),
    onSuccess: (r) => {
      toast.success(`Bot @${r.bot_username || pairName} spawned + webhook set`);
      setPairName(""); setPairLabel(""); setToken(""); setChannel(""); setBias("neutral");
      qc.invalidateQueries({ queryKey: ["fleet"] });
    },
    onError: (e: any) => toast.error(e?.message || "Spawn failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => callDelete({ data: { id } }),
    onSuccess: () => { toast.success("Bot decommissioned"); qc.invalidateQueries({ queryKey: ["fleet"] }); },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const tier = useMutation({
    mutationFn: (v: { id: string; tier: "FREE" | "PAID" }) => callTier({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fleet"] }),
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const active = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => callActive({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fleet"] }),
  });

  const freq = useMutation({
    mutationFn: (f: "aggressive" | "passive") => callFreq({ data: { frequency: f } }),
    onSuccess: (r) => { toast.success(`Frequency: ${r.frequency}`); qc.invalidateQueries({ queryKey: ["fleet"] }); },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const broadcast = useMutation({
    mutationFn: () => callBroadcast({ data: { message: broadcastMsg } }),
    onSuccess: (r) => {
      toast.success(`Broadcast: ${r.ok}/${r.total} bots`);
      setBroadcastMsg("");
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!user) return (
    <div className="p-8 text-center">
      <p className="text-muted-foreground mb-4">Sign in to access Fleet Commander.</p>
      <Button asChild><Link to="/auth">Sign In</Link></Button>
    </div>
  );

  const bots = data?.bots || [];
  const currentFreq = data?.settings?.global_frequency || "aggressive";

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Fleet Commander</h1>
        <p className="text-sm text-muted-foreground">Spawn per-pair Telegram bots, set tiers, broadcast Master commands.</p>
      </div>

      {error && <div className="rounded border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{(error as any)?.message}</div>}

      {/* Global frequency */}
      <section className="rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2"><Radio className="h-4 w-4" /> Global Frequency</h2>
            <p className="text-xs text-muted-foreground">Aggressive: Perplexity scout every 15 min. Passive: post only on Gemini 3 breakout detection.</p>
          </div>
          <span className="text-xs px-2 py-1 rounded bg-muted">{currentFreq.toUpperCase()}</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant={currentFreq === "aggressive" ? "default" : "outline"}
            onClick={() => freq.mutate("aggressive")}
            disabled={freq.isPending}
            className="flex-1"
          >
            <Zap className="h-4 w-4 mr-2" /> Aggressive · 15 min
          </Button>
          <Button
            variant={currentFreq === "passive" ? "default" : "outline"}
            onClick={() => freq.mutate("passive")}
            disabled={freq.isPending}
            className="flex-1"
          >
            <Moon className="h-4 w-4 mr-2" /> Passive · Breakout-only
          </Button>
        </div>
      </section>

      {/* Spawn */}
      <section className="rounded-lg border bg-card p-5">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-3"><Plus className="h-4 w-4" /> Spawn Bot</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input placeholder="Pair name (e.g. EURUSD)" value={pairName} onChange={e => setPairName(e.target.value)} />
          <Input placeholder="Display label (e.g. EUR / USD)" value={pairLabel} onChange={e => setPairLabel(e.target.value)} />
          <Input placeholder="Telegram bot token (123:ABC…)" type="password" value={token} onChange={e => setToken(e.target.value)} className="md:col-span-2" />
          <Input placeholder="Channel chat ID (-100… or @handle)" value={channel} onChange={e => setChannel(e.target.value)} />
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={bias} onChange={e => setBias(e.target.value as any)}>
            <option value="neutral">Bias · Neutral</option>
            <option value="good">Bias · Bullish</option>
            <option value="bad">Bias · Bearish</option>
          </select>
        </div>
        <Button
          onClick={() => spawn.mutate()}
          disabled={spawn.isPending || !pairName || !token}
          className="mt-3"
        >
          {spawn.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          Spawn Bot + Set Webhook
        </Button>
      </section>

      {/* Master broadcast */}
      <section className="rounded-lg border bg-card p-5">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-3"><Megaphone className="h-4 w-4" /> Master Broadcast</h2>
        <p className="text-xs text-muted-foreground mb-2">Sent simultaneously through every active pair-bot to its own channel.</p>
        <Textarea placeholder="e.g. NFP Data Release in 5 mins!" value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} rows={3} />
        <Button
          onClick={() => broadcast.mutate()}
          disabled={broadcast.isPending || !broadcastMsg.trim()}
          className="mt-3"
        >
          {broadcast.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Megaphone className="h-4 w-4 mr-2" />}
          Broadcast to Fleet
        </Button>
      </section>

      {/* Fleet table */}
      <section className="rounded-lg border bg-card">
        <div className="p-5 border-b">
          <h2 className="text-lg font-semibold">Fleet ({bots.length})</h2>
        </div>
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : bots.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No bots yet. Spawn your first one above.</div>
        ) : (
          <div className="divide-y">
            {bots.map((b: any) => (
              <div key={b.id} className="p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-mono text-sm font-semibold">{b.pair_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {b.bot_username ? `@${b.bot_username}` : "no username"} · token {b.telegram_bot_token} · chat {b.channel_chat_id || "—"}
                  </div>
                  {b.last_broadcast && (
                    <div className="text-[11px] text-muted-foreground mt-1 truncate max-w-md">↳ {b.last_broadcast}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Tier</span>
                  <button
                    onClick={() => tier.mutate({ id: b.id, tier: b.tier === "FREE" ? "PAID" : "FREE" })}
                    className={
                      "px-2 py-1 rounded font-semibold " +
                      (b.tier === "PAID" ? "bg-amber-500/20 text-amber-600 border border-amber-500/40" : "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30")
                    }
                  >
                    {b.tier}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Active</span>
                  <Switch checked={!!b.active} onCheckedChange={(v) => active.mutate({ id: b.id, active: v })} />
                </div>
                <Button variant="ghost" size="icon" onClick={() => del.mutate(b.id)} disabled={del.isPending}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-[11px] text-muted-foreground">
        Per-bot webhook → <code>/api/public/fleet/webhook/&lt;botId&gt;</code>. Tokens stored server-side; only last 4 digits ever leave the server.
      </p>
    </div>
  );
}