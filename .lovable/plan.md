## Scope check — important

You listed seven legacy admin hash sections to fold in: `admin#topups, admin#roster, admin#passes, admin#codes, admin#resellers, admin#share, admin#notes`.

When I grep `src/routes/admin.tsx` (2,702 lines), the actual hash sections that exist are:

```
roster · intel · spawners · broadcast · hubs · mood · homehubs · topups · command · nerd-stats
```

There is no `passes`, `codes`, `resellers`, `share`, or `notes` section on `/admin`. Those features live elsewhere:

- passes → `/boss/og-passes`, `/account/passes`, `vip-pass-pool.functions`
- codes  → no dedicated route (mint-code flow is buried inside admin roster row actions)
- resellers → `/reseller`, `reseller-audit`, `boss.reseller-audit.tsx`
- share → not found as a route or section
- notes → `/boss/todo` (notepad) and `BossTodoNotepad`

**Before I build this**, please confirm one of:
(a) Only fold in what actually exists (`topups`, `roster`, plus any of the others I can locate by feature), or
(b) Treat the list as a target taxonomy — I create empty/placeholder tabs for `codes / share / notes` and wire in the closest existing surface for `passes` and `resellers`, or
(c) You meant a different file (not `/admin`) — point me at it.

Below is the plan assuming **(b)**, which matches "first-class /boss/members tabs" most cleanly. Tell me if you want (a) or (c) instead and I'll re-plan.

---

## Plan (assuming option b)

### 1. New unified route: `src/routes/boss.members.tsx`

Single page using shadcn `<Tabs>` with these tabs, in order:

1. **Roster** — extracted from `admin.tsx` lines ~190–268 (search/filter/sort table, rank/credits/ban controls). Reuses existing `listRoster`, `setRank`, `setBanned`, `adjustCredits`, `setHubAccess` server fns. Member detail drawer is reused from existing pattern in `boss.users.tsx`.
2. **Top-Ups** — extracted from `admin.tsx#topups` section. Reuses `bossListTopupRequests`, `bossApproveTopup`, `bossDenyTopup`, `bossSetFriendsFamily`.
3. **Passes** — embeds the existing `boss.og-passes.tsx` panel + `vip-pass-pool` admin (same server fns).
4. **Codes** — promo/invite code minting. Pulls the inline mint-code action out of the admin roster and gives it its own panel. No new server fn.
5. **Resellers** — embeds existing reseller audit table (`boss.reseller-audit.tsx`) and reseller list.
6. **Share** — public share link / referral controls (placeholder panel if no current surface — to be filled when you specify what "share" should do).
7. **Notes** — embeds `BossTodoNotepad`.

Route lives at top-level `/boss/members` (sibling of `boss.overview.tsx`), gated by `requireBoss`. URL hash drives the active tab (`/boss/members#topups`) for deep-linkable parity with old `/admin#topups`.

### 2. De-dup Overview ↔ Power

`boss.overview.tsx` (782 LOC) and `boss.power.tsx` (520 LOC) both render:

- payment mode toggle
- coin freeze
- swear default
- reverse purchases panel

I will:

- Keep `boss.power.tsx` as the canonical home for these four controls (since the rail already labels it "Power Bar").
- Remove the duplicated blocks from `boss.overview.tsx` and replace with a single `<Link to="/boss/power">Open Power Bar</Link>` card so the overview stays a dashboard, not a control panel.
- No server-fn changes; same mutations remain in `PowerStatusBar` / power components.

### 3. Redirects

Add a tiny route file `src/routes/admin.legacy-redirect.ts`? No — `/admin` itself is still useful, so instead:

- In `src/routes/admin.tsx`, add a top-of-component `useEffect` that, if `location.hash` matches one of `#topups|#roster|#passes|#codes|#resellers|#share|#notes`, calls `navigate({ to: "/boss/members", hash: <same> , replace: true })`.
- This preserves `/admin` for the sections that aren't being moved (intel, spawners, broadcast, etc.) while transparently bouncing the seven listed hashes.

### 4. Rail / navigation

`src/routes/boss.tsx` rail update:
- People group: add **Members** → `/boss/members` as the top item; demote `Roster` to point at `/boss/members#roster`.
- Money & Power: keep `Power Bar` → `/boss/power`; remove the duplicate `Power Bar` that currently points at `/boss/overview`.
- Leave all other rail items untouched.

### 5. Files touched

```
NEW   src/routes/boss.members.tsx              (≈400 LOC; composes existing components)
EDIT  src/routes/boss.overview.tsx             (-~300 LOC; remove dup controls, add CTA card)
EDIT  src/routes/boss.tsx                      (rail entries)
EDIT  src/routes/admin.tsx                     (+~15 LOC; hash redirect effect)
```

No server functions, no migrations, no auth changes.

### 6. Out of scope (call out so we agree)

- I will not rewrite `boss.power.tsx`'s internals — only confirm it owns the four shared controls.
- I will not delete `/admin` or its remaining sections (intel/spawners/broadcast/hubs/mood/homehubs/command/nerd-stats stay where they are).
- I will not add new server functions or change any mutation contract.
- Visual styling reuses existing tokens; no new design tokens.

---

**Please confirm a/b/c above, and confirm the rail change in step 4, and I'll build it.**