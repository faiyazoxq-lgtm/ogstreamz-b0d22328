import { createFileRoute, Link } from "@tanstack/react-router";
import { requireVip } from "@/lib/route-guards";
import { PassesPanel } from "@/components/PassesPanel";
import { TelegramLinkCard } from "@/components/TelegramLinkCard";
import { ChevronLeft } from "lucide-react";
import { VaultGuard } from "@/components/VaultGuard";

export const Route = createFileRoute("/account/passes")({
  beforeLoad: requireVip,
  head: () => ({ meta: [{ title: "My Passes & Telegram · OG-Streamz" }] }),
  component: () => (
    <VaultGuard>
      <AccountPassesPage />
    </VaultGuard>
  ),
});

function AccountPassesPage() {
  return (
    <main className="relative max-w-3xl mx-auto px-5 sm:px-8 py-12">
      <header className="mb-6">
        <Link to="/dashboard" className="text-[11px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
          <ChevronLeft className="h-3 w-3" />Back to dashboard
        </Link>
        <p className="mt-3 text-xs tracking-[0.4em] uppercase font-semibold" style={{ color: "var(--neon-blue-bright)" }}>
          Account
        </p>
        <h1 className="mt-2 font-[Montserrat] font-black text-3xl sm:text-4xl text-metallic">
          Passes &amp; Telegram
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Track every VIP pass, store order and credit purchase. Link Telegram to receive expiry reminders and live updates.
        </p>
      </header>

      <div className="grid gap-6">
        <TelegramLinkCard />
        <PassesPanel />
      </div>
    </main>
  );
}