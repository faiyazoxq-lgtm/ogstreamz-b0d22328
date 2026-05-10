import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutDashboard, Sparkles, Compass, ArrowRight, Tv, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.jpg";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Welcome · Choose your portal — 0G-PORTAL" },
      {
        name: "description",
        content:
          "Pick where you want to sign in: The HUB, your Dashboard, or the full 0G-PORTAL universe.",
      },
      { property: "og:title", content: "Welcome · Choose your portal — 0G-PORTAL" },
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

  useEffect(() => {
    supabase
      .from("store_settings")
      .select("stream_portal_url")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        const u = (data as { stream_portal_url?: string } | null)?.stream_portal_url;
        if (u && /^https?:\/\//i.test(u)) setStreamUrl(u);
      });
  }, []);

  let streamHost = "";
  try {
    streamHost = new URL(streamUrl).host.replace(/^www\./, "");
  } catch {
    streamHost = streamUrl;
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10 sm:py-16">
        <header className="flex flex-col items-center gap-4 text-center">
          <img
            src={logo}
            alt="0G-PORTAL logo"
            className="h-14 w-14 rounded-xl border border-border shadow-sm"
          />
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Welcome
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Where do you want to sign in?
            </h1>
            <p className="mx-auto max-w-xl text-sm text-muted-foreground sm:text-base">
              Pick the door that fits what you're here for. You can switch between them
              any time once you're in.
            </p>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CHOICES.map(({ to, title, tagline, desc, Icon, accent }) => (
            <Link
              key={to}
              to="/auth"
              onClick={() => {
                if (typeof window !== "undefined") {
                  try {
                    sessionStorage.setItem("post_auth_redirect", to);
                  } catch {
                    // ignore storage errors (private mode etc.)
                  }
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
              <div className="relative mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
                Sign in to {title}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
              </div>
            </Link>
          ))}

          {/* External 0G STREAMZ profile sign-in */}
          <a
            href={streamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-destructive/30 to-destructive/5 opacity-60 transition group-hover:opacity-100"
              aria-hidden
            />
            <div className="relative flex items-center justify-between">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-background/80 ring-1 ring-border">
                <Tv className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Streaming portal
              </span>
            </div>
            <div className="relative space-y-1">
              <h2 className="text-xl font-semibold tracking-tight">0G STREAMZ Profile</h2>
              <p className="text-sm text-muted-foreground">
                Sign in on the streaming domain to manage your line, expiry and devices.
              </p>
            </div>
            <div className="relative mt-auto flex items-center justify-between text-sm font-medium text-primary">
              <span className="inline-flex items-center gap-1">
                Open {streamHost}
                <ExternalLink className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
              </span>
            </div>
          </a>
        </section>

        <footer className="flex flex-col items-center gap-2 text-center text-xs text-muted-foreground">
          <p>
            Already know where you're going?{" "}
            <Link to="/auth" className="font-medium text-primary hover:underline">
              Skip to sign in
            </Link>
          </p>
          <p>
            New here?{" "}
            <Link to="/auth" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}