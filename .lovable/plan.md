# Unified OG Pass Tier System

Today the codebase carries TWO parallel tier systems:
- `profiles.rank` (OG Pass): `prospect | enforcer | stream_user | vip | boss`
- `profiles.subscription_plan` + `syndicate_bots.tier_required` (Plans): `free | metal | energy | syndicate`

This plan collapses both into ONE canonical tier set defined by your rules:

| Canonical key | Display label | Definition |
|---|---|---|
| `free` | Free | Signed in, nothing else |
| `stream_user` | Stream User | Connected to OGSTREAMZ M3U |
| `vip` | VIP | Bought a VIP pass OR manually promoted |
| `real_og` | Real OG | VIP **and** M3U-connected (auto-derived) |
| `boss` | Boss | Admin / staff — manual only |

`real_og` is computed (vip + active stream link), not directly assignable. The other four are storable.

## What changes

### 1. Database (single migration)
- New enum `public.og_tier` = `('free','stream_user','vip','real_og','boss')`.
- Add `profiles.og_tier og_tier NOT NULL DEFAULT 'free'`.
- Backfill from existing data:
  - `rank='boss'` → `boss`
  - `rank='vip'` OR `subscription_plan IN ('energy','syndicate')` → `vip`
  - `rank='stream_user'` OR active row in `stream_links` → `stream_user`
  - everyone else → `free`
  - then promote `(og_tier='vip' AND has active stream_link)` → `real_og`
- Add trigger on `profiles` + `stream_links` to keep `real_og` derivation in sync (vip ↔ real_og when stream link toggles).
- Replace `syndicate_bots.tier_required` enum/text values: `metal→stream_user`, `energy→vip`, `syndicate→real_og`, `free→free`.
- Keep legacy `rank` and `subscription_plan` columns for one release as read-only mirrors (so nothing breaks mid-deploy), but stop writing to them from app code.
- RLS: only `boss` may set `boss`/`vip` directly; `stream_user` is set by the m3u-connect server fn; `real_og` is trigger-only.

### 2. Shared TypeScript catalog
New `src/lib/og-tier.ts` exporting:
```ts
export const OG_TIERS = ['free','stream_user','vip','real_og','boss'] as const;
export type OgTier = typeof OG_TIERS[number];
export const OG_TIER_LABEL: Record<OgTier,string> = {
  free: 'Free', stream_user: 'Stream User', vip: 'VIP',
  real_og: 'Real OG', boss: 'Boss',
};
export const OG_TIER_RANK: Record<OgTier,number> = { free:0, stream_user:1, vip:2, real_og:3, boss:4 };
export function meetsTier(user: OgTier, required: OgTier) { return OG_TIER_RANK[user] >= OG_TIER_RANK[required]; }
```
Every gate, badge, dropdown, and label across the site reads from this file — no more hard-coded tier strings.

### 3. UI surfaces to update
- `BossOgPassCard`, `MemberDetailDrawer`, `og-pass-actions.tsx` rank dropdowns → use OG_TIERS.
- `admin.tsx` Register Pair Channel + Plan picker (the screenshot you sent) → OG_TIERS.
- `boss.og-passes.tsx` filter chips → OG_TIERS.
- `vip.tsx`, `store.tsx`, `welcome.tsx`, `profile.tsx`, `settings.tsx`, `syndicate.tsx`, `syndicate-overlord.tsx` plan/tier copy → OG_TIER_LABEL.
- Coin store products that grant a plan → grant `vip` (or `real_og` if bundled with M3U).
- `vip-guard.ts`, `route-guards.ts`, `stream-tag.server.ts` → use `meetsTier`.
- `SyndicateProtocolSwitch`, `EnforcerConsole`, `BottomDock`, `NavBar`, `AppShell` badge/visibility logic → read `og_tier`.

### 4. Server functions
- `syndicate.functions.ts` `setSubscriberPlan` → `setOgTier(userId, tier)` with boss-only RLS check; emits audit log.
- `stream-link.functions.ts` connect/disconnect → no longer manually flips rank; relies on the trigger to recompute `stream_user`/`real_og`.
- `boss-users.functions.ts` `setRank` becomes `setOgTier` (same shape).

### 5. Cleanup (follow-up release, not in this PR)
After one deploy of dual-write/read, drop `profiles.rank`, `profiles.subscription_plan`, and the `syndicate_plan` enum.

## Out of scope
- No visual redesign of cards or pages — labels and dropdown options only.
- Coin/GBP formatting stays as-is.
- Telegram bot side does not need changes; it already reads `tier_required` as a string.

## Risk / rollback
- One migration, fully reversible (it only adds a column + trigger; legacy columns untouched until follow-up).
- If anything regresses, we can map UI back to `rank`/`subscription_plan` by flipping `og-tier.ts` to read the legacy columns.

Approve and I'll ship the migration + code changes in one pass.