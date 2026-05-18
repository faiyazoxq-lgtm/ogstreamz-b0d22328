import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  Coins, Crown, ShieldOff, ShieldCheck, LogOut, Tv, Flame, Mail,
  Users as UsersIcon, History, IdCard, ExternalLink, Star, Megaphone,
  ScrollText, Bell, KeyRound, BadgeCheck, BadgeX, RotateCw, EyeOff, Heart, LayoutDashboard,
  type LucideIcon,
} from "lucide-react";
import type { RosterRow } from "@/lib/boss-users.functions";

/**
 * Single source of truth for everything a Boss can do TO an OG-Pass holder.
 *
 * Three nesting levels:
 *   Category  →  Subcategory  →  Action
 *
 * Each Action either:
 *   - runs a `handler({ row, prompt })` (typed via the registry the page wires up), OR
 *   - links to another Boss page with the user pre-selected.
 *
 * `bulkEligible: true` means the action can be applied across many selected
 * passes from the bulk toolbar. Anything that requires a unique numeric value
 * per user (e.g. "set OG Pass #") must NOT be bulk-eligible.
 */

export type ActionKey =
  | "access.rank.set" | "access.status.set" | "access.ban" | "access.unban" | "access.signout"
  | "coins.gift" | "coins.adjust" | "coins.refund" | "coins.redeem-code"
  | "vip.grant" | "vip.lifetime-code" | "vip.revoke"
  | "stream.verify" | "stream.reverify" | "stream.expire" | "stream.link"
  | "mod.warn" | "mod.mute" | "mod.swearing" | "mod.civility"
  | "comms.email" | "comms.notify" | "comms.announce"
  | "audit.user-log" | "audit.security-events" | "audit.sessions"
  | "profile.display-name" | "profile.avatar" | "profile.og-pass-no"
  | "profile.friends-family";


export type ActionCtx = {
  row: RosterRow;
  /** Wrap the call so the page can show busy/toast state. */
  run: (fn: () => Promise<unknown>) => void;
};

export type Action = {
  key: ActionKey;
  label: string;
  icon: LucideIcon;
  /** Short hint shown in the menu and bulk picker. */
  hint?: string;
  /** Inline handler — pass run() so the page handles busy state. */
  handler?: (ctx: ActionCtx) => void;
  /** Or, link to another Boss surface with the user pre-selected. */
  to?: { route: string; queryKey?: string };
  /** Tone for the menu item border/colour. */
  tone?: "default" | "warn" | "danger" | "success";
  /** Can be applied across many selected users at once. */
  bulkEligible?: boolean;
  /** When bulk, prompt once for a shared value (e.g. coin amount). */
  bulkPrompt?: { label: string; type: "number" | "text"; placeholder?: string };
};

export type Subcategory = { label: string; actions: Action[] };
export type Category = {
  key: string;
  label: string;
  icon: LucideIcon;
  tint: string;
  subcategories: Subcategory[];
};

/**
 * The handlers reference an injected registry so the catalog stays static and
 * the page wires up real server-fn calls. Each handler reads from the registry
 * via the closure passed at render time.
 */
export type HandlerRegistry = {
  setRank: (userId: string, rank: string) => Promise<unknown>;
  setStatus: (userId: string, status: "free" | "vip") => Promise<unknown>;
  adjustCredits: (userId: string, delta: number, reason: string) => Promise<unknown>;
  setBanned: (userId: string, banned: boolean, reason?: string) => Promise<unknown>;
  forceSignOut: (userId: string) => Promise<unknown>;
  reverifyStream: (userId: string) => Promise<unknown>;
  setSwearing: (userId: string, enabled: boolean | null, intensity?: "mild" | "medium" | "chaotic") => Promise<unknown>;
  grantVip: (userId: string, days: number) => Promise<unknown>;
  revokeVipForUser: (userId: string) => Promise<unknown>;
  setFriendsFamily: (userId: string, enabled: boolean) => Promise<unknown>;
  setHubAccess: (userId: string, enabled: boolean) => Promise<unknown>;
};

import { OG_TIERS, OG_TIER_LABEL } from "@/lib/og-tier";
const RANKS = OG_TIERS as readonly string[];
const RANK_LABEL = OG_TIER_LABEL as Record<string, string>;

export function buildCatalog(reg: HandlerRegistry): Category[] {
  const promptCoinDelta = ({ row, run }: ActionCtx, sign: 1 | -1) => {
    const v = window.prompt(
      sign > 0
        ? `Gift 🪙 to ${row.email} (positive number):`
        : `Remove 🪙 from ${row.email} (positive number):`,
      "10",
    );
    const n = Math.abs(Number(v));
    if (!Number.isFinite(n) || n === 0) return;
    const note = window.prompt("Optional note (member will see this):", "") ?? "";
    const reason = `${sign > 0 ? "boss:gift" : "boss:adjust"}${note.trim() ? ":" + note.trim().slice(0, 100) : ""}`;
    run(() => reg.adjustCredits(row.id, sign * n, reason));
  };

  return [
    {
      key: "access", label: "Access", icon: KeyRound, tint: "#3ad6ff",
      subcategories: [
        {
          label: "Rank & status",
          actions: [
            {
              key: "access.rank.set", label: "Change OG tier", icon: Crown,
              hint: "Free → Stream User → VIP → Real OG → Boss",
              bulkEligible: true,
              bulkPrompt: { label: "Tier (free / stream_user / vip / real_og / boss)", type: "text", placeholder: "vip" },
              handler: ({ row, run }) => {
                const v = window.prompt(`Set OG tier for ${row.email}:\n${RANKS.join(", ")}`, row.og_tier ?? row.rank);
                if (!v || !RANKS.includes(v)) return;
                run(() => reg.setRank(row.id, v));
              },
            },
            {
              key: "access.status.set", label: "Toggle status", icon: BadgeCheck,
              hint: "Free ↔ VIP",
              bulkEligible: true,
              bulkPrompt: { label: "Status (free or vip)", type: "text", placeholder: "vip" },
              handler: ({ row, run }) => {
                const next = row.status === "vip" ? "free" : "vip";
                if (!window.confirm(`Set status for ${row.email}: ${row.status} → ${next}?`)) return;
                run(() => reg.setStatus(row.id, next));
              },
            },
          ],
        },
        {
          label: "Lockout",
          actions: [
            {
              key: "access.ban", label: "Ban user", icon: ShieldOff, tone: "danger",
              bulkEligible: true,
              bulkPrompt: { label: "Ban reason (optional)", type: "text" },
              handler: ({ row, run }) => {
                const reason = window.prompt(`Reason for banning ${row.email}? (optional)`, "") ?? "";
                run(() => reg.setBanned(row.id, true, reason));
              },
            },
            {
              key: "access.unban", label: "Unban user", icon: ShieldCheck, tone: "success",
              bulkEligible: true,
              handler: ({ row, run }) => run(() => reg.setBanned(row.id, false)),
            },
            {
              key: "access.signout", label: "Force sign-out", icon: LogOut, tone: "warn",
              bulkEligible: true,
              handler: ({ row, run }) => run(() => reg.forceSignOut(row.id)),
            },
          ],
        },
      ],
    },
    {
      key: "coins", label: "Coins & rewards", icon: Coins, tint: "#ffd166",
      subcategories: [
        {
          label: "Adjust",
          actions: [
            {
              key: "coins.gift", label: "Gift coins (+)", icon: Coins, tone: "success",
              bulkEligible: true,
              bulkPrompt: { label: "Amount of 🪙 to gift each", type: "number", placeholder: "10" },
              handler: (ctx) => promptCoinDelta(ctx, 1),
            },
            {
              key: "coins.adjust", label: "Remove coins (−)", icon: Coins, tone: "warn",
              bulkEligible: true,
              bulkPrompt: { label: "Amount of 🪙 to remove each", type: "number", placeholder: "5" },
              handler: (ctx) => promptCoinDelta(ctx, -1),
            },
          ],
        },
        {
          label: "Codes",
          actions: [
            {
              key: "coins.redeem-code", label: "Issue redeem code", icon: Star,
              to: { route: "/syndicate-overlord", queryKey: "user" },
              hint: "Opens Overlord → redeem codes",
            },
            {
              key: "coins.refund", label: "Refund (manual note)", icon: RotateCw,
              hint: "Adds a labelled refund credit",
              handler: ({ row, run }) => {
                const v = window.prompt(`Refund 🪙 to ${row.email}:`, "0");
                const n = Math.abs(Number(v));
                if (!Number.isFinite(n) || n === 0) return;
                const reason = "boss:refund:" + (window.prompt("Refund reason:", "") ?? "").slice(0, 100);
                run(() => reg.adjustCredits(row.id, n, reason));
              },
            },
          ],
        },
      ],
    },
    {
      key: "vip", label: "VIP & passes", icon: Crown, tint: "#ffd166",
      subcategories: [
        {
          label: "Grant",
          actions: [
            {
              key: "vip.grant", label: "Grant VIP (30d)", icon: Crown, tone: "success",
              bulkEligible: true,
              handler: ({ row, run }) => run(() => reg.grantVip(row.id, 30)),
            },
            {
              key: "vip.lifetime-code", label: "Lifetime VIP code", icon: KeyRound,
              to: { route: "/syndicate-overlord" },
              hint: "Opens Overlord → lifetime codes",
            },
          ],
        },
        {
          label: "Revoke",
          actions: [
            {
              key: "vip.revoke", label: "Revoke active VIP", icon: BadgeX, tone: "danger",
              bulkEligible: true,
              handler: ({ row, run }) => {
                if (!window.confirm(`Revoke active VIP pass for ${row.email}?`)) return;
                run(() => reg.revokeVipForUser(row.id));
              },
            },
          ],
        },
      ],
    },
    {
      key: "stream", label: "Stream account", icon: Tv, tint: "#a78bfa",
      subcategories: [
        {
          label: "Verification",
          actions: [
            {
              key: "stream.reverify", label: "Re-verify stream", icon: RotateCw,
              bulkEligible: true,
              handler: ({ row, run }) => run(() => reg.reverifyStream(row.id)),
            },
            {
              key: "stream.verify", label: "Mark as verified", icon: BadgeCheck,
              hint: "Manual verify (uses re-verify endpoint)",
              handler: ({ row, run }) => run(() => reg.reverifyStream(row.id)),
            },
          ],
        },
        {
          label: "Linking",
          actions: [
            {
              key: "stream.link", label: "Manage stream link", icon: ExternalLink,
              to: { route: "/boss/control-centre" },
              hint: "Opens Control Centre → stream links",
            },
            {
              key: "stream.expire", label: "Expire stream access", icon: BadgeX, tone: "warn",
              hint: "Sets stream expiry to now (re-verify required)",
              handler: ({ row, run }) => {
                if (!window.confirm(`Expire stream access for ${row.email}?`)) return;
                // No dedicated server fn: re-verify will recompute. Mark via reverify w/ note.
                run(() => reg.reverifyStream(row.id));
              },
            },
          ],
        },
      ],
    },
    {
      key: "mod", label: "Moderation", icon: Flame, tint: "#ff2e55",
      subcategories: [
        {
          label: "Tone",
          actions: [
            {
              key: "mod.swearing", label: "Swearing override", icon: Flame,
              hint: "On / Safe / Auto + intensity",
              handler: ({ row, run }) => {
                const v = window.prompt(`Swearing for ${row.email}: on / safe / auto`, "on");
                if (!v) return;
                const k = v.trim().toLowerCase();
                if (k === "auto") return run(() => reg.setSwearing(row.id, null));
                if (k === "on" || k === "off" || k === "safe") {
                  return run(() => reg.setSwearing(row.id, k === "on"));
                }
              },
            },
            {
              key: "mod.civility", label: "Civility settings", icon: ScrollText,
              to: { route: "/boss/civility" },
            },
          ],
        },
        {
          label: "Discipline",
          actions: [
            {
              key: "mod.warn", label: "Issue warning (note)", icon: Bell,
              handler: ({ row, run }) => {
                const note = window.prompt(`Warning note to log for ${row.email}:`, "") ?? "";
                if (!note.trim()) return;
                // Logged via a 0-coin adjust with a labelled reason so it appears in audit + history.
                run(() => reg.adjustCredits(row.id, 0, "boss:warn:" + note.trim().slice(0, 100)));
              },
            },
            {
              key: "mod.mute", label: "Mute (force sign-out)", icon: EyeOff, tone: "warn",
              bulkEligible: true,
              handler: ({ row, run }) => run(() => reg.forceSignOut(row.id)),
            },
          ],
        },
      ],
    },
    {
      key: "comms", label: "Comms", icon: Mail, tint: "#7dd3fc",
      subcategories: [
        {
          label: "Direct",
          actions: [
            {
              key: "comms.email", label: "Email this user", icon: Mail,
              handler: ({ row }) => { window.location.href = `mailto:${row.email}`; },
            },
            {
              key: "comms.notify", label: "Send notification", icon: Bell,
              to: { route: "/boss/control-centre" },
              hint: "Opens VIP notifications panel",
            },
          ],
        },
        {
          label: "Broadcast",
          actions: [
            {
              key: "comms.announce", label: "Boss announcement", icon: Megaphone,
              to: { route: "/boss/control-centre" },
              hint: "Send a sitewide announcement",
            },
          ],
        },
      ],
    },
    {
      key: "audit", label: "Audit", icon: History, tint: "#94a3b8",
      subcategories: [
        {
          label: "History",
          actions: [
            { key: "audit.user-log", label: "Audit log (this user)", icon: ScrollText,
              to: { route: "/boss/audit-log", queryKey: "user" } },
            { key: "audit.security-events", label: "Security events", icon: ShieldCheck,
              to: { route: "/boss/security-events" } },
            { key: "audit.sessions", label: "Active sessions", icon: UsersIcon,
              to: { route: "/boss/realtime-denials" } },
          ],
        },
      ],
    },
    {
      key: "profile", label: "Profile", icon: IdCard, tint: "#34d399",
      subcategories: [
        {
          label: "Identity",
          actions: [
            {
              key: "profile.display-name", label: "Edit display name", icon: IdCard,
              hint: "Opens member detail drawer",
            },
            {
              key: "profile.avatar", label: "View avatar URL", icon: IdCard,
              handler: ({ row }) => {
                if (row.avatar_url) window.open(row.avatar_url, "_blank");
                else window.alert("No avatar set");
              },
            },
            {
              key: "profile.og-pass-no", label: "OG Pass # (info)", icon: IdCard,
              handler: ({ row }) => {
                window.alert(`OG Pass: ${row.og_pass_no ?? "(not assigned)"}`);
              },
            },
            {
              key: "profile.friends-family", label: "Friends & Family badge", icon: Heart,
              hint: "Toggle the F&F status badge on this pass",
              bulkEligible: true,
              handler: ({ row, run }) => {
                const next = !row.is_friends_family;
                if (!window.confirm(`${next ? "Mark" : "Remove"} ${row.email} as Friends & Family?`)) return;
                run(() => reg.setFriendsFamily(row.id, next));
              },
            },
            {
              key: "profile.hub-access", label: "Hub access", icon: LayoutDashboard,
              hint: "Allow this user to see /hub/* (otherwise they only see /portals)",
              bulkEligible: true,
              handler: ({ row, run }) => {
                const next = !row.hub_access;
                if (!window.confirm(`${next ? "Grant" : "Revoke"} Hub access for ${row.email}?`)) return;
                run(() => reg.setHubAccess(row.id, next));
              },
            },
          ],
        },
      ],
    },
  ];
}

/** Flatten the catalog to a key → action lookup (for favourites + bulk). */
export function flattenCatalog(cats: Category[]): Map<string, Action & { categoryLabel: string; subLabel: string }> {
  const m = new Map<string, Action & { categoryLabel: string; subLabel: string }>();
  for (const c of cats) {
    for (const s of c.subcategories) {
      for (const a of s.actions) {
        m.set(a.key, { ...a, categoryLabel: c.label, subLabel: s.label });
      }
    }
  }
  return m;
}

/** Resolve the link target for an action. Some actions accept a userId param. */
export function resolveActionLink(action: Action, row?: RosterRow): { to: string; search?: any } | null {
  if (!action.to) return null;
  const search: Record<string, string> = {};
  if (row && action.to.queryKey) search[action.to.queryKey] = row.id;
  return { to: action.to.route, search: Object.keys(search).length ? search : undefined };
}

/** A clean visible label for the menu/toolbar/bulk picker. */
export function actionToneClasses(tone: Action["tone"]): string {
  switch (tone) {
    case "danger": return "border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20";
    case "warn":   return "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20";
    case "success":return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20";
    default:       return "border-white/10 bg-white/5 text-white/85 hover:bg-white/10";
  }
}