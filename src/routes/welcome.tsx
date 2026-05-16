import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutDashboard, Sparkles, Compass, ArrowRight, Tv, ExternalLink, Send, CheckCircle2, Coins, Gift, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.jpg";
import { FlameBackdrop } from "@/components/FlameBackdrop";
import { SiteGuideSwearChat } from "@/components/SiteGuideSwearChat";
import { VerifyStreamAccessCard } from "@/components/VerifyStreamAccessCard";
import { StreamStatusWidget } from "@/components/StreamStatusWidget";
import { getTelegramLinkStatus } from "@/lib/account-passes.functions";
import { useSignupBonus } from "@/hooks/use-signup-bonus";

// ----- Configurable Welcome layout -----
// Order of the bottom CTA stack. Sections auto-hide when their `connected`
// predicate is true, so the page collapses as the user wires things up.
type SectionId = "signin" | "telegram" | "verify_stream" | "stream_status" | "guide";
const WELCOME_LAYOUT: SectionId[] = [
  "signin",        // Sign-in / sign-up choice cards (hidden once signed in)
  "guide",         // Guttermouth guide (always shown)
  "telegram",      // Connect Telegram (hidden once linked)
  "verify_stream", // Verify Stream Access (hidden once stream tagged active)
  "stream_status", // Live status widget (hidden if nothing to show & not signed in)
];

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Welcome · Login / sign up — 0G-PORTAL" },
      {
        name: "description",
        content:
          "Login / sign up to The HUB, your Dashboard, or the full 0G-PORTAL universe.",
      },
      { property: "og:title", content: "Welcome · Login / sign up — 0G-PORTAL" },
      {
        property: "og:description",
        content: "Three doors. One Syndicate. Pick your entry point.",
      },
    ],
  }),
  component: WelcomePage,
});

type Choice = {
  to: "/" | "/dashboard" | "/portals";
  title: string;
  tagline: string;
  desc: string;
  Icon: typeof Compass;
  accent: string;
};

const CHOICES: Choice[] = [
  {
    to: "/",
    title: "The HUB",
    tagline: "Home base",
    desc: "Land in the main hub — quick access to every Syndicate channel and your stream link.",
    Icon: Compass,
    accent: "from-primary/30 to-primary/5",
  },
  {
    to: "/dashboard",
    title: "Dashboard",
    tagline: "Your control room",
    desc: "Credits, passes, stream status, history. Everything personal in one panel.",
    Icon: LayoutDashboard,
    accent: "from-accent/30 to-accent/5",
  },
  {
    to: "/portals",
    title: "0G-PORTAL",
    tagline: "The full universe",
    desc: "Browse every portal — Music, Jokes, Trade, Connect, Battle, Tools and more.",
    Icon: Sparkles,
    accent: "from-secondary/40 to-secondary/5",
  },
];

function WelcomePage() {
  const [streamUrl, setStreamUrl] = useState<string>("https://ogstreamz.co.uk");
  const { user, profile } = useAuth();
  const fetchTgStatus = useServerFn(getTelegramLinkStatus);
  const [tgLinked, setTgLinked] = useState<boolean | null>(null);

  // Keep telegram-linked state fresh while signed in.
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setTgLinked(null);
      return;
    }
    (async () => {
      try {
        const s: any = await fetchTgStatus();
        if (!cancelled) setTgLinked(!!s?.chat_id);
      } catch {
        if (!cancelled) setTgLinked(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, fetchTgStatus]);

  useEffect(() => {
    let cancelled = false;
    async function loadStreamUrl() {
      const { data } = await supabase
        .from("store_settings")
        .select("stream_portal_url")
        .eq("id", 1)
        .maybeSingle();
      if (cancelled) return;
      const u = (data as { stream_portal_url?: string } | null)?.stream_portal_url;
      if (u && /^https?:\/\//i.test(u)) setStreamUrl(u);
    }
    loadStreamUrl();

    // Live updates: re-read whenever the boss saves a new portal URL.
    const channel = supabase
      .channel("store_settings_welcome")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "store_settings" },
        (payload) => {
          const next = (payload.new as { stream_portal_url?: string } | null)
            ?.stream_portal_url;
          if (next && /^https?:\/\//i.test(next)) setStreamUrl(next);
          else loadStreamUrl();
        },
      )
      .subscribe();

    // Safety net: refetch when the tab regains focus.
    const onVisible = () => {
      if (document.visibilityState === "visible") loadStreamUrl();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, []);

  let streamHost = "";
  try {
    streamHost = new URL(streamUrl).host.replace(/^www\./, "");
  } catch {
    streamHost = streamUrl;
  }

  // Connection state per option — drives auto-hide of CTAs / banners.
  const signedIn = !!user;
  const telegramConnected = signedIn && tgLinked === true;
  const streamActive = (() => {
    if (!signedIn || !profile) return false;
    const status = (profile.stream_status || "").toLowerCase();
    const exp = profile.stream_expires_at ? new Date(profile.stream_expires_at).getTime() : 0;
    const notExpired = exp === 0 || exp > Date.now();
    if (!notExpired) return false;
    return (
      status === "active" ||
      profile.rank === "stream_user" ||
      profile.rank === "vip" ||
      profile.rank === "boss"
    );
  })();

  const showSignin = !signedIn;
  const showTelegram = signedIn && !telegramConnected;
  const showVerify = signedIn && !streamActive;
  const showStatus = signedIn; // widget renders its own empty/active states

  const renderSection = (id: SectionId) => {
    switch (id) {
      case "signin":
        if (!showSignin) return null;
        return (
          <section key="signin" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CHOICES.map(({ to, title, tagline, desc, Icon, accent }) => (
              <Link
                key={to}
                to="/auth"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    try { sessionStorage.setItem("post_auth_redirect", to); } catch { /* ignore */ }
                  }
                }}
                className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent} opacity-60 transition group-hover:opacity-100`}
                  aria-hidden
                />
                <div className="relative flex items-center justify-between">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-background/80 ring-1 ring-border">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {tagline}
                  </span>
                </div>
                <div className="relative space-y-1">
                  <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
                <div className="relative mt-auto text-sm font-medium leading-snug text-primary">
                  <span>Login / sign up to </span>
                  <span className="inline-flex items-baseline whitespace-nowrap align-baseline">
                    {title}
                    <ArrowRight className="ml-1 inline-block h-4 w-4 shrink-0 translate-y-[2px] transition group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </div>
              </Link>
            ))}

            {/* External 0G STREAMZ profile sign-in (only while signed-out) */}
            <a
              href={streamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-destructive/30 to-destructive/5 opacity-60 transition group-hover:opacity-100" aria-hidden />
              <div className="relative flex items-center justify-between">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-background/80 ring-1 ring-border">
                  <Tv className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Streaming portal</span>
              </div>
              <div className="relative space-y-1">
                <h2 className="text-xl font-semibold tracking-tight">0G STREAMZ Profile</h2>
                <p className="text-sm text-muted-foreground">
                  Login / sign up on the streaming domain to manage your line, expiry and devices.
                </p>
              </div>
              <div className="relative mt-auto text-sm font-medium leading-snug text-primary">
                <span>Open </span>
                <span className="inline-flex items-baseline whitespace-nowrap align-baseline break-all">
                  <span className="break-all">{streamHost}</span>
                  <ExternalLink className="ml-1 inline-block h-4 w-4 shrink-0 translate-y-[2px] transition group-hover:translate-x-0.5" aria-hidden />
                </span>
              </div>
            </a>
          </section>
        );

      case "guide":
        return (
          <section key="guide" className="mx-auto w-full max-w-3xl">
            <div className="mb-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                Lost? Ask the gremlin
              </p>
              <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
                Foul-mouthed site guide
              </h2>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Type what you want to do — it'll spit out a sitemap of where to go.
              </p>
            </div>
            <SiteGuideSwearChat />
          </section>
        );

      case "telegram":
        if (!showTelegram) return null;
        return (
          <section key="telegram" className="mx-auto w-full max-w-3xl">
            <div className="rounded-2xl border border-sky-500/40 bg-sky-500/5 p-4 sm:p-5 backdrop-blur-md">
              <div className="flex items-start gap-3">
                <Send className="h-5 w-5 text-sky-300 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold uppercase tracking-[0.25em]">Connect Telegram</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Required for group invites, live drops and pass alerts. One quick link and you're in.
                  </p>
                </div>
                <Link
                  to="/connect-telegram"
                  className="shrink-0 inline-flex items-center gap-2 rounded-md bg-sky-500 px-3 py-1.5 text-xs font-semibold text-sky-950 hover:bg-sky-400 transition"
                >
                  Connect <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </section>
        );

      case "verify_stream":
        if (!showVerify) return null;
        return (
          <section key="verify_stream" className="mx-auto w-full max-w-3xl">
            <VerifyStreamAccessCard signedIn={signedIn} />
          </section>
        );

      case "stream_status":
        if (!showStatus) return null;
        return (
          <section key="stream_status" className="mx-auto w-full max-w-3xl">
            <StreamStatusWidget />
          </section>
        );

      default:
        return null;
    }
  };

  const allConnected = signedIn && telegramConnected && streamActive;

  return (
    <div className="relative min-h-dvh overflow-hidden text-foreground">
      {/* Brand wallpaper */}
      <FlameBackdrop
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-bottom opacity-[0.10] mix-blend-overlay sm:opacity-[0.08] sm:object-center"
        style={{
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 55% at 50% 60%, transparent 0%, rgba(0,0,0,0.35) 45%, #000 80%)",
          maskImage:
            "radial-gradient(ellipse 70% 55% at 50% 60%, transparent 0%, rgba(0,0,0,0.35) 45%, #000 80%)",
        }}
      />
      <div className="relative mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10 sm:py-16">
        <header className="flex flex-col items-center gap-4 text-center">
          <img
            src={logo}
            alt="0G-PORTAL logo"
            className="h-14 w-14 rounded-xl border border-border shadow-sm"
          />
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {signedIn ? "Welcome back" : "Welcome"}
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {signedIn ? "Finish wiring up your account" : "Login / sign up"}
            </h1>
            <p className="mx-auto max-w-xl text-sm text-muted-foreground sm:text-base">
              {signedIn
                ? "Each step below disappears once it's connected. When the list is empty, you're fully wired in."
                : "The ultimate portal home — create, describe and generate content from your tailored portal. Pick a door below to get started."}
            </p>
            {allConnected && (
              <div className="mx-auto mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" /> All set — you're fully connected
              </div>
            )}
          </div>
        </header>

        {!signedIn && <SignupBonusHero />}

        {WELCOME_LAYOUT.map((id) => renderSection(id))}

        {!signedIn && (
          <footer className="flex flex-col items-center gap-2 text-balance text-center text-xs text-muted-foreground">
            <p className="max-w-xs sm:max-w-none">
              Already know where you're going?{" "}
              <Link to="/auth" className="whitespace-nowrap font-medium text-primary hover:underline">
                Skip to login / sign up
              </Link>
            </p>
            <p className="max-w-xs sm:max-w-none">
              New here?{" "}
              <Link to="/auth" className="whitespace-nowrap font-medium text-primary hover:underline">
                Create an account
              </Link>
            </p>
          </footer>
        )}
      </div>
    </div>
  );
}

function SignupBonusHero() {
  const bonus = useSignupBonus();
  return (
    <section className="mx-auto w-full max-w-3xl">
      <div className="relative overflow-hidden rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-300/10 via-background to-background p-5 shadow-sm sm:p-6">
        <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-amber-300/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-300/50 bg-amber-300/15 shadow-[0_0_30px_-6px_rgba(252,211,77,0.7)]">
            <Coins className="h-6 w-6 text-amber-300" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight text-amber-300 sm:text-4xl">
                +{bonus}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-300/85">
                credits on signup
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Free credits land in your wallet the moment your account is confirmed —
              spend them on any portal.
            </p>
            <ul className="mt-3 grid gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:grid-cols-3">
              <li className="flex items-center gap-1.5">
                <Gift className="h-3.5 w-3.5 text-amber-300" aria-hidden /> {bonus} free credits
              </li>
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-300" aria-hidden /> No card required
              </li>
              <li className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" aria-hidden /> All portals unlocked
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}