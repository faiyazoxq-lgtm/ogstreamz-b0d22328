import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Crown, ChevronDown, Lock, KeyRound, ShieldCheck,
  Inbox, Send, Coins, Sparkles, ArrowUpRight,
} from "lucide-react";

type VaultLink = {
  to: string;
  title: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const links: ReadonlyArray<VaultLink> = [
  { to: "/profile",          title: "Member Vault",      desc: "Your profile, credits & passes", Icon: ShieldCheck },
  { to: "/vip",              title: "VIP Lounge",        desc: "Premium-only frequencies",        Icon: Crown },
  { to: "/account/passes",   title: "Real OG Passes",    desc: "Manage active passes",            Icon: KeyRound },
  { to: "/wallet",           title: "Coin Wallet",       desc: "Balance, top-ups & history",      Icon: Coins },
  { to: "/connect-telegram", title: "Telegram Inbox",    desc: "Boss DMs & alerts",               Icon: Inbox },
  { to: "/syndicate",        title: "Syndicate Channel", desc: "Members-only live rooms",         Icon: Send },
];

export function OgVaultAccessSection() {
  const [open, setOpen] = useState(true);

  return (
    <section className="relative max-w-7xl mx-auto px-5 sm:px-8 pb-10">
      <div className="rounded-2xl border border-gold/30 bg-[color-mix(in_oklab,var(--gold)_4%,transparent)] shadow-[0_0_40px_-20px_var(--gold)] overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="og-vault-access-panel"
          className="w-full flex items-center gap-3 px-4 sm:px-6 py-4 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors hover:bg-gold/[0.06]"
        >
          <span className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-gold/50 bg-gold/10 text-gold shadow-[0_0_18px_-6px_var(--gold)]">
            <Lock className="h-4 w-4" aria-hidden />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[10px] uppercase tracking-[0.35em] text-gold/80 font-semibold">
              VIP Only
            </span>
            <span className="flex items-center gap-2 font-[Montserrat] font-black text-lg sm:text-xl text-gold">
              0G Vault Access
              <Sparkles className="h-4 w-4 opacity-80" aria-hidden />
            </span>
          </span>
          <ChevronDown
            className={`h-5 w-5 text-gold transition-transform duration-300 ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>

        <div
          id="og-vault-access-panel"
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="px-4 sm:px-6 pb-5 pt-1 grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {links.map(({ to, title, desc, Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="group relative flex items-start gap-3 rounded-xl border border-gold/25 bg-background/40 hover:bg-gold/[0.08] hover:border-gold/60 px-4 py-3 transition-all hover:shadow-[0_0_22px_-6px_var(--gold)] outline-none focus-visible:ring-[3px] focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Icon className="h-5 w-5 mt-0.5 text-gold/80 group-hover:text-gold shrink-0" aria-hidden />
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-foreground group-hover:text-gold transition-colors">
                      {title}
                    </span>
                    <span className="block text-xs text-muted-foreground">{desc}</span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-gold/60 group-hover:text-gold transition-colors shrink-0" aria-hidden />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}