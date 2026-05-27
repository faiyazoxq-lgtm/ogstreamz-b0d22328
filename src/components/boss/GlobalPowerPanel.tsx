import { useEffect, useState } from "react";
import { Power, CreditCard, Coins, Skull } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePaymentMode, setPaymentMode } from "@/hooks/use-payment-mode";
import { CollapsiblePanel } from "@/components/boss/CollapsiblePanel";
import { PowerToggle, type PowerToggleConfirm } from "@/components/boss/PowerToggle";
import { toast } from "sonner";

/**
 * Canonical global power controls: payment mode, coin freeze, swear default.
 * Single source of truth — mounted on /boss/overview.
 */
export function GlobalPowerPanel() {
  const paymentMode = usePaymentMode();
  const [togglingPayments, setTogglingPayments] = useState(false);
  const [coinFrozen, setCoinFrozen] = useState<boolean | null>(null);
  const [togglingCoin, setTogglingCoin] = useState(false);
  const [swearDefault, setSwearDefault] = useState<boolean | null>(null);
  const [togglingSwear, setTogglingSwear] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [civ, coin] = await Promise.all([
        supabase.from("civility_settings").select("swear_default").limit(1).maybeSingle(),
        supabase.from("app_settings").select("value").eq("key", "power.coin_frozen").maybeSingle(),
      ]);
      if (cancelled) return;
      setSwearDefault(civ?.data?.swear_default ?? null);
      setCoinFrozen(coin?.data?.value === true);
    })();
    return () => { cancelled = true; };
  }, []);

  async function applyPaymentMode(next: "live" | "test") {
    setTogglingPayments(true);
    try { await setPaymentMode(next); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to switch payment mode"); }
    finally { setTogglingPayments(false); }
  }
  function togglePaymentMode() {
    void applyPaymentMode(paymentMode === "live" ? "test" : "live");
  }
  async function toggleCoinFreeze() {
    if (coinFrozen === null) return;
    setTogglingCoin(true);
    const next = !coinFrozen;
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "power.coin_frozen", value: next }, { onConflict: "key" });
    if (!error) setCoinFrozen(next); else toast.error(error.message);
    setTogglingCoin(false);
  }
  async function toggleSwear() {
    if (swearDefault === null) return;
    setTogglingSwear(true);
    const next = !swearDefault;
    const { error } = await supabase
      .from("civility_settings")
      .update({ swear_default: next, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (!error) setSwearDefault(next); else toast.error(error.message);
    setTogglingSwear(false);
  }

  const paymentsConfirm: PowerToggleConfirm = {
    when: "always",
    tone: paymentMode === "live" ? "warning" : "danger",
    title: paymentMode === "live"
      ? "Switch payments to TEST mode?"
      : "Switch payments to LIVE mode?",
    description: paymentMode === "live" ? (
      <>
        <p>Every checkout site-wide will move to <strong>sandbox cards only</strong>.</p>
        <p className="text-amber-300">Real customers will see a "Test Mode" banner and cannot complete real purchases.</p>
      </>
    ) : (
      <>
        <p>Every checkout site-wide will charge <strong>real money</strong> to real cards immediately. Sandbox cards will be rejected.</p>
        <p className="text-orange-300">The "Test Mode" banner will disappear for all members the moment you confirm.</p>
        <p className="text-white/60 text-xs">Only switch to live when Stripe products & prices are fully verified for production.</p>
      </>
    ),
    confirmLabel: paymentMode === "live" ? "Yes, go TEST" : "Yes, go LIVE",
    cancelLabel: paymentMode === "live" ? "Stay in live mode" : "Stay in test mode",
    typeToConfirm: paymentMode === "live" ? undefined : "GO LIVE",
  };

  const coinConfirm: PowerToggleConfirm = {
    when: "deactivate",
    tone: "danger",
    title: "Freeze all coin flows?",
    description: (
      <>
        <p>Every member will be <strong>blocked from earning or spending credits</strong> until you thaw.</p>
        <p className="text-rose-300">Active battles, tips and store purchases will fail mid-flight.</p>
      </>
    ),
    confirmLabel: "Freeze coins",
    cancelLabel: "Keep flowing",
    typeToConfirm: "FREEZE",
  };

  const swearConfirm: PowerToggleConfirm = {
    when: "activate",
    tone: "warning",
    title: "Default new sessions to Guttermouth?",
    description: (
      <p>New visitors will land in foul-mouth chat by default. Existing sessions are unaffected.</p>
    ),
    confirmLabel: "Unleash",
    cancelLabel: "Stay civil",
  };

  return (
    <div id="power">
      <CollapsiblePanel
        id="pwr.toggles"
        title="Power Bar"
        Icon={Power}
        tint="#ffd166"
        subtitle="One-tap master switches — payments, coins & chat tone"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <PowerToggle
            title="Payments"
            Icon={CreditCard}
            active={paymentMode === "live"}
            activeLabel="LIVE"
            inactiveLabel="TEST"
            activeTint="#00e08a"
            inactiveTint="#ff9940"
            activeHint="Charging real cards site-wide"
            inactiveHint="Sandbox only · safe to toggle on"
            onToggle={togglePaymentMode}
            saving={togglingPayments}
            ready
            confirm={paymentsConfirm}
          />
          <PowerToggle
            title="Coin transactions"
            Icon={Coins}
            active={coinFrozen === false}
            activeLabel="FLOWING"
            inactiveLabel="FROZEN"
            activeTint="#00e08a"
            inactiveTint="#ff5577"
            activeHint="Earn / spend live across the site"
            inactiveHint="All earn / spend halted — tap to thaw"
            onToggle={toggleCoinFreeze}
            saving={togglingCoin}
            ready={coinFrozen !== null}
            confirm={coinConfirm}
          />
          <PowerToggle
            title="Guttermouth"
            Icon={Skull}
            active={swearDefault === true}
            activeLabel="ON"
            inactiveLabel="OFF"
            activeTint="#ff2e55"
            inactiveTint="#3ad6ff"
            activeHint="Foul-mouth chat is default for new sessions"
            inactiveHint="Civil mode default · tap to unleash"
            onToggle={toggleSwear}
            saving={togglingSwear}
            ready={swearDefault !== null}
            confirm={swearConfirm}
          />
        </div>
      </CollapsiblePanel>
    </div>
  );
}