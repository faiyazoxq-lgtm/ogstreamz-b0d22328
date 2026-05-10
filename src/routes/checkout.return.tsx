import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
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
  return (
    <main className="relative min-h-[calc(100vh-4rem)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <FlameBackdrop className="absolute inset-0 w-full h-full object-cover opacity-15 mix-blend-screen" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/85 to-background" />
      </div>
      <div className="relative max-w-xl mx-auto px-5 sm:px-8 py-20 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14" style={{ color: "var(--neon-blue-bright)" }} />
        <h1 className="mt-6 font-[Montserrat] font-black text-3xl sm:text-5xl text-metallic">
          Vault Topped Up
        </h1>
        <p className="mt-3 text-muted-foreground text-sm">
          {session_id
            ? "Payment confirmed — credits will appear on your dashboard within seconds."
            : "Payment confirmed."}
        </p>
        <Link
          to="/profile"
          className="btn-glass-blue mt-8 inline-flex items-center gap-2 px-8 py-3 rounded-md text-xs uppercase tracking-[0.3em] font-bold text-white"
        >
          Return to Member Vault
        </Link>
      </div>
    </main>
  );
}