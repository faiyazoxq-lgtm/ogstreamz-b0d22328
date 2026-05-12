import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Loader2, Radio, Brain, Music, Megaphone, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { runPowerPack, listMyPowerPacks } from "@/lib/power-pack.functions";
import { supabase } from "@/integrations/supabase/client";
import { requireBossHub, requireTelegramLink } from "@/lib/route-guards";

export const Route = createFileRoute("/syndicate")({
  beforeLoad: async (ctx) => {
    await requireBossHub(ctx);
    await requireTelegramLink(ctx);
  },
  head: () => ({
    meta: [
      { title: "0G-Syndicate Mesh — Boss Command" },
      { name: "description", content: "Issue a Boss command — Perplexity scouts, Gemini reasons, Suno produces, Telegram broadcasts." },
    ],
  }),
  component: SyndicatePage,
});

const STAGES = [
  { key: "scouting", label: "Scouting", icon: Radio },
  { key: "reasoning", label: "Reasoning", icon: Brain },
  { key: "producing", label: "Producing", icon: Music },
  { key: "broadcast", label: "Broadcast", icon: Megaphone },
  { key: "complete", label: "Complete", icon: CheckCircle2 },
];

function StatusPill({ status }: { status: string }) {
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-destructive/10 text-destructive border border-destructive/40">
        <AlertCircle className="h-3 w-3" /> error
      </span>
    );
  }
  const idx = STAGES.findIndex((s) => s.key === status);
  return (
    <div className="flex items-center gap-1.5">
      {STAGES.map((s, i) => {
        const active = i <= idx;
        const Icon = s.icon;
        return (
          <div
            key={s.key}
            className={
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border transition-colors " +
              (active
                ? "bg-gold/15 border-gold/50 text-gold"
                : "bg-background/40 border-border text-muted-foreground")
            }
            title={s.label}
          >
            <Icon className="h-3 w-3" />
            <span className="hidden sm:inline">{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function SyndicatePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fire = useServerFn(runPowerPack);
  const list = useServerFn(listMyPowerPacks);

  const [asset, setAsset] = useState("XAU");
  const [bias, setBias] = useState<"bullish" | "bearish" | "neutral">("bullish");
  const [command, setCommand] = useState("Boss, Gold is breaking $4,760. Prepare the Syndicate.");

  const { data, isLoading } = useQuery({
    queryKey: ["power-packs"],
    queryFn: () => list(),
    enabled: !!user,
    refetchInterval: 8000,
  });

  const mut = useMutation({
    mutationFn: () => fire({ data: { asset, bias, command } }),
    onSuccess: () => {
      toast.success("Power Pack dispatched");
      qc.invalidateQueries({ queryKey: ["power-packs"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Dispatch failed"),
  });

  // realtime nudge
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("power-packs-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "power_packs", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["power-packs"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, qc]);

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 animate-fade-in">
      <header className="mb-8">
        <p className="text-[10px] sm:text-xs tracking-[0.4em] text-gold uppercase font-semibold">
          0G-Syndicate Mesh
        </p>
        <h1 className="mt-2 font-[Montserrat] font-black text-3xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.05]">
          Give the <span className="text-gradient-gold">Order.</span>
        </h1>
        <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-2xl">
          Perplexity scouts → Gemini reasons → Suno produces → Telegram broadcasts. One command, four agents, one Power Pack.
        </p>
      </header>

      <section className="rounded-2xl border border-gold/40 bg-gradient-to-br from-card to-background p-4 sm:p-6 shadow-[0_0_60px_oklch(0.82_0.16_88_/_0.08)] backdrop-blur-xl">
        <div className="grid gap-4 sm:grid-cols-[140px_140px_1fr_auto] items-end">
          <div>
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Asset</label>
            <Input value={asset} onChange={(e) => setAsset(e.target.value)} className="mt-1 bg-background/60" maxLength={40} />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Bias</label>
            <select
              value={bias}
              onChange={(e) => setBias(e.target.value as any)}
              className="mt-1 w-full h-10 rounded-md bg-background/60 border border-border px-2 text-sm"
            >
              <option value="bullish">Bullish</option>
              <option value="bearish">Bearish</option>
              <option value="neutral">Neutral</option>
            </select>
          </div>
          <div className="sm:col-span-1">
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Boss Command</label>
            <Textarea
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="mt-1 min-h-20 bg-background/60 font-mono text-sm"
              maxLength={500}
            />
          </div>
          <Button
            onClick={() => {
              if (!user) return toast.error("Sign in first");
              mut.mutate();
            }}
            disabled={mut.isPending || !command.trim()}
            size="lg"
            className="bg-gold text-primary-foreground hover:bg-gold/90 font-bold tracking-wide w-full sm:w-auto"
          >
            {mut.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Dispatching…
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" /> Dispatch
              </>
            )}
          </Button>
        </div>
      </section>

      <h2 className="mt-10 mb-3 text-sm uppercase tracking-[0.3em] text-muted-foreground">Recent Packs</h2>
      <div className="grid gap-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {(data?.packs ?? []).map((p: any) => (
          <article
            key={p.id}
            className="rounded-xl border border-border bg-card/60 backdrop-blur p-4 hover:border-gold/40 transition-colors"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold tracking-tight">{p.asset}</span>
                  <span className={
                    "text-[10px] uppercase px-1.5 py-0.5 rounded border " +
                    (p.bias === "bullish"
                      ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                      : p.bias === "bearish"
                      ? "border-red-500/40 text-red-400 bg-red-500/10"
                      : "border-border text-muted-foreground")
                  }>{p.bias}</span>
                  <StatusPill status={p.status} />
                </div>
                <p className="mt-2 text-sm text-foreground/90 line-clamp-2">{p.summary || p.command}</p>
                {p.suno_audio_url && (
                  <audio controls src={p.suno_audio_url} className="mt-3 w-full max-w-md" />
                )}
                {Array.isArray(p.headlines) && p.headlines.length > 0 && (
                  <ul className="mt-3 text-xs text-muted-foreground space-y-0.5 list-decimal list-inside">
                    {p.headlines.slice(0, 3).map((h: string, i: number) => (
                      <li key={i} className="truncate">{h}</li>
                    ))}
                  </ul>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                {new Date(p.created_at).toLocaleString()}
              </span>
            </div>
          </article>
        ))}
        {!isLoading && (data?.packs ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No packs yet — dispatch your first command above.</p>
        )}
      </div>
    </main>
  );
}