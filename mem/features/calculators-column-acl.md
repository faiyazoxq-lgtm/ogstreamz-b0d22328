---
name: Calculators column ACL
description: Which public.calculators columns are readable by anon vs authenticated and how VIP-gated config fields are protected
type: feature
---
- `anon` role has NO direct SELECT on `public.calculators`. The RLS policy `Authenticated can view published calculators` is `TO authenticated` only.
- Anonymous reads MUST go through the `public.calculators_public` view. It selects published rows and strips VIP-only config keys: `deepExplanation`, `steps`, `kidExplain`.
- Routes that load calculators as anon (SSR/public): `t.$slug`, `tools`, `sitemap[.]xml`, `SiteSearch`, `portals` (list), `vip.portals` (count) — all read `calculators_public`.
- VIP-only config fields are delivered through the `getToolVipContent` server function (auth + VIP gated), never via the table or the view.
- Authenticated server functions and admin/boss tooling keep using `public.calculators` directly under the existing RLS policies.
- Adding a new VIP-only config key: update the view definition to subtract it (and update `getToolVipContent`) so it can never leak via anon.
- The view is `security_invoker = false` by design (Supabase linter flags this as "Security Definer View" — accepted: same pattern as portals_public).
