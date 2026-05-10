import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CreditCard, Coins, Skull, ShieldCheck, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Tone = "live" | "test" | "frozen" | "warn";

const TONE: Record<Tone, { dot: string; text: string; bg: string; ring: string }> = {
  live:   { dot: "#00e08a", text: "#7be3b6", bg: "rgba(0,224,138,0.10)",  ring: "#00e08a55" },
  test:   { dot: "#ff9940", text: "#ffb87a", bg: "rgba(255,153,64,0.10)", ring: "#ff994055" },
  frozen: { dot: "#ff5577", text: "#ff8aa3", bg: "rgba(255,85,119,0.10)", ring: "#ff557755" },
  warn:   { dot: "#ffd166", text: "#ffd166", bg: "rgba(255,209,102,0.10)",ring: "#ffd16655" },
};

function Pill({
  tone, label, value, Icon, active,
}: {
  tone: Tone;
  label: string;
  value: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  active?: boolean;
}) {
  const t = TONE[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] tabular-nums shrink-0 transition-all"
      style={{
        background: t.bg,
        color: t.text,
        border: `1px solid ${t.ring}`,
        boxShadow: active ? `0 0 14px -4px ${t.dot}` : "none",
        outline: active ? `1px solid ${t.dot}aa` : "none",
        outlineOffset: active ? 1 : 0,
      }}
      title={`${label}: ${value}`}
    >
      <Icon className="h-3 w-3" style={{ color: t.dot }} />
      <span className="hidden sm:inline text-white/55 font-bold">{label}</span>
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: t.dot }}>
        <span
          className="absolute inset-0 rounded-full"
          style={{ background: t.dot, animation: "ping 1.8s cubic-bezier(0,0,0.2,1) infinite", opacity: 0.6 }}
        />
      </span>
      {value}
    </span>
  );
}

export function PowerStatusBar() {
  const [paymentsLive, setPaymentsLive] = useState<boolean | null>(null);
  const [coinFrozen, setCoinFrozen] = useState<boolean | null>(null);
  const [swearOn, setSwearOn] = useState<boolean | null>(null);
  const [synced, setSynced] = useState<Date | null>(null);

  const refresh = async () => {
    const [{ data: pay }, { data: coin }, { data: civ }] = await Promise.all([
      supabase.from("payments_settings").select("mode").eq("id", 1).maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "power.coin_frozen").maybeSingle(),
      supabase.from("civility_settings").select("swear_default").limit(1).maybeSingle(),
    ]);
    setPaymentsLive(pay?.mode === "live");
    setCoinFrozen(coin?.value === true);
    setSwearOn(civ?.swear_default === true);
    setSynced(new Date());
  };

  useEffect(() => {
    void refresh();
    const ch = supabase
      .channel("boss_power_status")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments_settings" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "civility_settings" }, refresh)
      .subscribe();
    const t = setInterval(refresh, 60_000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, []);

  const anyAlert =
    paymentsLive === false || coinFrozen === true || swearOn === true;

  return (
    <Link
      to="/boss/overview"
      hash="power"
      aria-label="Open Power Bar"
      className="flex items-center gap-1.5 overflow-x-auto no-scrollbar rounded-full px-2 py-1 ring-1 ring-white/5 bg-black/20 hover:ring-gold/40 transition"
    >
      <span
        className="hidden md:inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.3em] terminal-mono font-bold pl-1 pr-0.5"
        style={{ color: anyAlert ? "#ffd166" : "#7be3b6" }}
      >
        <Activity className="h-3 w-3" /> Status
      </span>
      <Pill
        tone={paymentsLive === null ? "warn" : paymentsLive ? "live" : "test"}
        label="Pay"
        value={paymentsLive === null ? "…" : paymentsLive ? "LIVE" : "TEST"}
        Icon={CreditCard}
        active={paymentsLive === true}
      />
      <Pill
        tone={coinFrozen === null ? "warn" : coinFrozen ? "frozen" : "live"}
        label="Coins"
        value={coinFrozen === null ? "…" : coinFrozen ? "FROZEN" : "LIVE"}
        Icon={Coins}
        active={coinFrozen === false}
      />
      <Pill
        tone={swearOn === null ? "warn" : swearOn ? "frozen" : "live"}
        label="Chat"
        value={swearOn === null ? "…" : swearOn ? "GUTTER" : "CIVIL"}
        Icon={swearOn ? Skull : ShieldCheck}
        active={swearOn === true || swearOn === false}
      />
      {synced && (
        <span className="hidden lg:inline text-[9px] uppercase tracking-[0.25em] terminal-mono text-white/30 pr-1">
          {synced.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </Link>
  );
}