import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Crown } from "lucide-react";

/**
 * VIP "no-escape" trap for non-members on /vip.
 *
 * Listens for any click/tap on the page and — after a short, deliberate
 * lag — pops a floating "Buy VIP" button right under the tap location.
 * Clicking the floater routes to the coin top-up flow (`/wallet?topup=1`).
 *
 * Notes:
 * - The trap itself has no DOM footprint until a tap fires, so the page
 *   stays interactive (this is a nudge, not a jail).
 * - Auto-dismisses after 4s if untouched, or on the next tap (which spawns
 *   a fresh floater) — keeps the screen from littering.
 * - The lag is intentional: it makes the CTA feel like it "follows" the
 *   user instead of fighting them.
 */
export function NonMemberTrap({ active }: { active: boolean }) {
  const navigate = useNavigate();
  const [pop, setPop] = useState<{ x: number; y: number; key: number } | null>(null);
  const lagTimer = useRef<number | null>(null);
  const dismissTimer = useRef<number | null>(null);
  const keyRef = useRef(0);

  useEffect(() => {
    if (!active) return;

    function clear() {
      if (lagTimer.current) window.clearTimeout(lagTimer.current);
      if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
    }

    function onPointer(e: PointerEvent) {
      const tgt = e.target as HTMLElement | null;
      // Ignore taps on the floater itself.
      if (tgt?.closest?.("[data-vip-trap-cta]")) return;

      clear();
      const x = e.pageX;
      const y = e.pageY;
      keyRef.current += 1;
      const key = keyRef.current;

      lagTimer.current = window.setTimeout(() => {
        setPop({ x, y, key });
        dismissTimer.current = window.setTimeout(() => {
          setPop((cur) => (cur?.key === key ? null : cur));
        }, 4000);
      }, 280);
    }

    window.addEventListener("pointerdown", onPointer, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      clear();
    };
  }, [active]);

  if (!active || !pop) return null;

  const BTN_W = 220;
  const left = Math.max(12, Math.min(pop.x - BTN_W / 2, window.innerWidth - BTN_W - 12));
  const top = pop.y + 14;

  return (
    <button
      type="button"
      data-vip-trap-cta
      onClick={() =>
        navigate({ to: "/wallet", search: { topup: "1", reason: "vip-trap" } as never })
      }
      style={{ position: "absolute", top, left, width: BTN_W, zIndex: 9999 }}
      className="pointer-events-auto inline-flex items-center justify-center gap-2 rounded-full border border-amber-300/70 bg-gradient-to-r from-amber-400 to-yellow-300 px-5 py-3 text-[12px] font-black uppercase tracking-[0.22em] text-black shadow-[0_10px_40px_-6px_rgba(255,200,80,0.8),0_0_0_4px_rgba(0,0,0,0.4)] animate-in fade-in zoom-in-90 duration-200"
    >
      <Crown className="h-4 w-4" /> Buy VIP
    </button>
  );
}

export default NonMemberTrap;