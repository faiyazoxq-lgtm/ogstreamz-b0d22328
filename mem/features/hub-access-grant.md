---
name: Hub access grant
description: How /hub/* visibility is gated — boss + per-user `profiles.hub_access` toggle
type: feature
---
- `/hub/*` and all hub-style routes (music, jokes, tools, trade, connect, battle, syndicate, syndicate-overlord, letterhub, battlehub, formhub, appealhub, jokes.portal, hub.$slug) are gated by `requireBossHub` in `src/lib/route-guards.ts`.
- `requireBossHub` allows: rank=boss, user_roles=admin, OR `profiles.hub_access = true`. Everyone else is redirected to `/portals`.
- The HubsStrip in `src/routes/__root.tsx` (`HubsStripSlot`) follows the same rule — hidden unless boss or `hub_access`.
- `profiles.hub_access` is a non-null boolean defaulting to `false`. Boss toggles it via the OG-Passes console (`profile.hub-access` action) which calls `setHubAccess` in `src/lib/boss-users.functions.ts` (audit-logged as `set_hub_access`).
- When adding new hub-style routes, gate them with `requireBossHub` — never `requireMember` — so non-granted users land on `/portals`.