import { createFileRoute } from "@tanstack/react-router";
import { exactPathRedirect } from "@/lib/boss-redirects";
import { useEffect, useMemo, useState } from "react";
import {
  Send,
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  Globe,
  Users,
  ShieldCheck,
  MessageSquare,
  Image as ImageIcon,
  ListChecks,
  RotateCcw,
  Megaphone,
  Loader2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useServerFn } from "@tanstack/react-start";
import { requestMembersConnectTelegram } from "@/lib/telegram-invites.functions";

const BOT_USERNAME = "Ogstreamzbot";
const BOTFATHER_URL = "https://t.me/BotFather";

const DOMAINS = [
  "ogstreamz.lovable.app",
  "www.ogstreamz.co.uk",
  "ogstreamz.co.uk",
];

type Step = {
  id: string;
  title: string;
  desc: string;
  command: string;
  /** Optional follow-up answer the user pastes back to BotFather. */
  answer?: string;
  Icon: typeof Globe;
  why: string;
};

const STEPS: Step[] = [
  {
    id: "select-bot",
    title: "Open BotFather and pick @" + BOT_USERNAME,
    desc: "Send /mybots, then tap @" + BOT_USERNAME + " from the list. Every following step is run inside that bot's edit panel.",
    command: "/mybots",
    Icon: ListChecks,
    why: "All other commands act on whichever bot you have selected.",
  },
  ...DOMAINS.map<Step>((d) => ({
    id: "setdomain-" + d,
    title: "Whitelist " + d + " for the Login Widget",
    desc:
      "Run /setdomain in BotFather, choose @" +
      BOT_USERNAME +
      ", then paste the domain when prompted.",
    command: "/setdomain",
    answer: d,
    Icon: Globe,
    why:
      "The Telegram Login Widget will refuse to render on " +
      d +
      " until that exact host is on the bot's domain whitelist.",
  })),
  {
    id: "setprivacy",
    title: "Disable privacy mode (group reads)",
    desc: "Run /setprivacy → @" + BOT_USERNAME + " → Disable. Required so the bot can read /commands inside Syndicate groups.",
    command: "/setprivacy",
    answer: "Disable",
    Icon: ShieldCheck,
    why: "With privacy ON the bot only sees messages that mention it directly — group features break.",
  },
  {
    id: "setjoingroups",
    title: "Allow the bot to be added to groups",
    desc: "Run /setjoingroups → @" + BOT_USERNAME + " → Enable.",
    command: "/setjoingroups",
    answer: "Enable",
    Icon: Users,
    why: "Without this, Syndicate group invites delivered through the bot will fail to add it.",
  },
  {
    id: "setcommands",
    title: "Publish the slash-command menu",
    desc:
      "Run /setcommands → @" +
      BOT_USERNAME +
      ", then paste the command list below so members see them in Telegram's menu.",
    command: "/setcommands",
    answer:
      "start - Link your 0G-STREAMZ account\nlink - Re-link with a fresh code\nstatus - Show your current pass + credits\nhelp - Show available commands",
    Icon: MessageSquare,
    why: "Members can discover /link and /status without typing them blind.",
  },
  {
    id: "setuserpic",
    title: "Set bot avatar (optional polish)",
    desc: "Run /setuserpic → @" + BOT_USERNAME + " and upload the 0G-STREAMZ mark.",
    command: "/setuserpic",
    Icon: ImageIcon,
    why: "Brand recognition in DMs and group member lists.",
  },
  {
    id: "setdescription",
    title: "Set bot description (optional)",
    desc: "Run /setdescription → @" + BOT_USERNAME + " and paste the blurb below.",
    command: "/setdescription",
    answer:
      "Official 0G-STREAMZ bot. Link your account at https://www.ogstreamz.co.uk to receive pass alerts, drop notifications and Syndicate group invites.",
    Icon: MessageSquare,
    why: "Shown in the empty chat state when a member opens the bot for the first time.",
  },
];

const STORAGE_KEY = "boss.telegram-setup.v1";

function loadDone(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export const Route = createFileRoute("/boss/telegram-setup")({
  beforeLoad: exactPathRedirect("/boss/telegram-setup", () => ({
    to: "/boss/infrastructure",
    hash: "telegram-setup",
  })),
  component: () => null,
});

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(label + " copied");
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={onCopy}
      className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
      aria-label={"Copy " + label}
    >
      {copied ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

export function TelegramSetupPage() {
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setDone(loadDone());
  }, []);

  const persist = (next: Record<string, boolean>) => {
    setDone(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
  };

  const toggle = (id: string) => persist({ ...done, [id]: !done[id] });
  const reset = () => persist({});

  const completed = useMemo(
    () => STEPS.filter((s) => done[s.id]).length,
    [done],
  );
  const pct = Math.round((completed / STEPS.length) * 100);
  const allDone = completed === STEPS.length;

  // Boss broadcast: prompt every unlinked member to add @Ogstreamzbot.
  const sendInvites = useServerFn(requestMembersConnectTelegram);
  const [inviting, setInviting] = useState(false);
  const [lastInvite, setLastInvite] = useState<{
    invited: number;
    alreadyLinked: number;
  } | null>(null);

  const onInviteAll = async () => {
    setInviting(true);
    try {
      const r = (await sendInvites()) as {
        invited: number;
        alreadyLinked: number;
      };
      setLastInvite({ invited: r.invited, alreadyLinked: r.alreadyLinked });
      toast.success(
        r.invited === 0
          ? "Everyone is already linked to Telegram."
          : `Invited ${r.invited} member${r.invited === 1 ? "" : "s"} to connect Telegram.`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invite blast failed";
      toast.error(msg);
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">Telegram Setup</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            One-time configuration for <strong>@{BOT_USERNAME}</strong> via BotFather.
            Work through each step and tick them off as you go.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button asChild size="sm" className="gap-1.5">
            <a href={BOTFATHER_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Open BotFather
            </a>
          </Button>
          <Button size="sm" variant="ghost" onClick={reset} className="text-muted-foreground hover:text-foreground gap-1">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </div>

      {/* Member outreach banner */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20">
            <Megaphone className="h-4 w-4 text-amber-400" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-foreground">Invite members to connect Telegram</h2>
              <Badge variant="outline" className="text-[10px] font-normal text-amber-400 border-amber-400/20">
                Outreach
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground max-w-lg leading-relaxed">
              Send an in-app prompt to every unlinked member with a one-tap link to grab their code at{" "}
              <code className="text-foreground">/account/passes</code>.
              Once linked, they can run <code>/me</code>, <code>/credits</code> and <code>/msg</code> from chat.
            </p>
            {lastInvite && (
              <p className="mt-2 text-[11px] font-mono text-muted-foreground">
                Last blast: {lastInvite.invited} invited · {lastInvite.alreadyLinked} already linked
              </p>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            onClick={onInviteAll}
            disabled={inviting}
            className="shrink-0 bg-amber-500 hover:bg-amber-400 text-black font-semibold"
          >
            {inviting ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-1.5" />
            )}
            {inviting ? "Sending…" : "Send invites"}
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="rounded-xl border border-border bg-card/60 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Progress
            </p>
            {allDone && (
              <Badge variant="outline" className="text-[10px] gap-1 font-normal text-emerald-400 border-emerald-400/20">
                <CheckCircle2 className="h-3 w-3" />
                All done
              </Badge>
            )}
          </div>
          <p className="text-xs font-mono text-foreground">
            {completed} / {STEPS.length} · {pct}%
          </p>
        </div>
        <div
          className="h-2 w-full rounded-full bg-muted overflow-hidden"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-[width] duration-500"
            style={{ width: pct + "%" }}
          />
        </div>
      </div>

      {/* Steps */}
      <ol className="space-y-2" aria-label="BotFather setup steps">
        {STEPS.map((step, i) => {
          const isDone = !!done[step.id];
          const Icon = step.Icon;
          return (
            <li
              key={step.id}
              className={`rounded-xl border transition-colors ${
                isDone
                  ? "border-emerald-500/20 bg-emerald-500/[0.03]"
                  : "border-border bg-card/60"
              }`}
            >
              <div className="flex items-start gap-3 p-4">
                <button
                  type="button"
                  onClick={() => toggle(step.id)}
                  aria-pressed={isDone}
                  aria-label={isDone ? "Mark step incomplete" : "Mark step complete"}
                  className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    isDone
                      ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-400"
                      : "border-border bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Circle className="h-3.5 w-3.5" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  {/* Step identity */}
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Step {i + 1} of {STEPS.length}
                    </p>
                    {isDone && (
                      <Badge variant="outline" className="text-[10px] font-normal text-emerald-400 border-emerald-400/20">
                        Done
                      </Badge>
                    )}
                  </div>
                  <h3 className={`mt-0.5 text-sm font-semibold leading-tight ${isDone ? "text-emerald-100" : "text-foreground"}`}>
                    <Icon className="inline h-3.5 w-3.5 mr-1 -mt-0.5 text-sky-400" />
                    {step.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {step.desc}
                  </p>

                  {/* Command */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <code className="font-mono text-xs bg-background/80 border border-border rounded-md px-2.5 py-1 select-all">
                      {step.command}
                    </code>
                    <CopyButton text={step.command} label={step.command} />
                  </div>

                  {/* Answer */}
                  {step.answer && (
                    <div className="mt-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                        Paste this reply into BotFather
                      </p>
                      <div className="flex items-start gap-2">
                        <pre className="flex-1 max-w-full whitespace-pre-wrap break-all font-mono text-[11px] bg-background/80 border border-border rounded-md px-2.5 py-1.5 select-all">
                          {step.answer}
                        </pre>
                        <div className="shrink-0 pt-0.5">
                          <CopyButton text={step.answer} label="Reply" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Why */}
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground/80">
                    <Info className="h-3 w-3 shrink-0 mt-0.5 opacity-60" />
                    <span>{step.why}</span>
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
        Tick state is stored locally in this browser only — it's a memory aid, not a server-side audit trail.
        Re-run any step at any time; BotFather always overwrites the previous value.
      </p>
    </div>
  );
}
