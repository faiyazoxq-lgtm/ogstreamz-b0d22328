import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getTelegramLinkStatus } from "@/lib/account-passes.functions";
import { useAuth } from "@/hooks/use-auth";
import { FlameBackdrop } from "@/components/FlameBackdrop";
import { requireMember } from "@/lib/route-guards";

type Search = { session_id?: string };

export const Route = createFileRoute("/checkout/return")({
  beforeLoad: requireMember,
  validateSearch: (search: Record<string, unknown>): Search => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({ meta: [{ title: "Wallet Updated · 0G-PORTAL" }] }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id } = Route.useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fetchStatus = useServerFn(getTelegramLinkStatus);
  const [needsLink, setNeedsLink] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const s = (await fetchStatus()) as { chat_id: number | null } | null;
        if (cancelled) return;
        const linked = !!s?.chat_id;
        setNeedsLink(!linked);
        if (!linked) {
          try {
            sessionStorage.setItem("post_telegram_redirect", "/profile");
          } catch { /* ignore */ }
          setTimeout(() => navigate({ to: "/connect-telegram" }), 1500);
        }
      } catch {
        setNeedsLink(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  return (
    <main className="relative min-h-[calc(100vh-4rem)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <FlameBackdrop className="absolute inset-0 w-full h-full object-cover opacity-15 mix-blend-screen" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/85 to-background" />
      </div>
      <div className="relative max-w-xl mx-auto px-5 sm:px-8 py-20 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14" style={{ color: "var(--neon-blue-bright)" }} />
        <h1 className="mt-6 font-[Montserrat] font-black text-3xl sm:text-5xl text-metallic">
          Payment Confirmed
        </h1>
        <p className="mt-3 text-muted-foreground text-sm">
          {session_id
            ? "Your purchase is locked in — your pass and any credits will appear shortly."
            : "Payment confirmed."}
        </p>
        {needsLink ? (
          <div className="mt-8 rounded-2xl border-2 border-sky-500/50 bg-sky-950/30 p-5 text-left">
            <p className="text-sm font-bold text-sky-200 flex items-center gap-2">
              <Send className="h-4 w-4" /> One last step — connect Telegram
            </p>
            <p className="mt-2 text-xs text-sky-100/75 leading-snug">
              Your VIP / Streams pass is tied to your <strong>OG Pass number</strong>.
              Link Telegram so the team can deliver passes, drops and renewal alerts
              direct to your handle. Redirecting you now…
            </p>
            <Link
              to="/connect-telegram"
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-sky-500 hover:bg-sky-400 text-black px-5 py-2 text-[11px] uppercase tracking-[0.25em] font-black"
            >
              Connect Telegram now <Send className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <Link
            to="/profile"
            className="btn-glass-blue mt-8 inline-flex items-center gap-2 px-8 py-3 rounded-md text-xs uppercase tracking-[0.3em] font-bold text-white"
          >
            Return to Member Vault
          </Link>
        )}
      </div>
    </main>
  );
}