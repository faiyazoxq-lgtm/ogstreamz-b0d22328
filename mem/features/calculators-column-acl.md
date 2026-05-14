---
name: Calculators column ACL
description: Which public.calculators columns are readable by anon vs authenticated and how VIP-gated config fields are protected
type: feature
---
- Neither `anon` nor `authenticated` has direct SELECT on `public.calculators`. The only RLS policy on the table is `Admins manage calculators` (`FOR ALL`, admin role).
- All non-admin reads (anon AND authenticated) MUST go through the `public.calculators_public` view. It selects published rows and strips VIP-only config keys: `deepExplanation`, `steps`, `kidExplain`.
- Routes/components that read calculators client-side: `t.$slug`, `tools`, `sitemap[.]xml`, `SiteSearch`, `portals` (list), `vip.portals` (count), `vip.portals.$hub`, `BossSearch` — all read `calculators_public`.
- VIP-only config fields are delivered through the `getToolVipContent` server function (auth + VIP gated), never via the table or the view.
- Admin-only server functions (e.g. `spawnTool`, `runAutomatedScout`) keep using `public.calculators` directly under the `Admins manage calculators` policy. `getToolVipContent` uses `supabaseAdmin` to read the full config after enforcing the VIP check.
- Adding a new VIP-only config key: update the view definition to subtract it (and update `getToolVipContent`) so it can never leak via anon.
- The view is `security_invoker = false` by design (Supabase linter flags this as "Security Definer View" — accepted: same pattern as portals_public).
