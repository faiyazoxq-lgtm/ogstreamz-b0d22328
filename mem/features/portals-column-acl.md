---
name: Portals column ACL
description: Which public.portals columns are readable by anon vs authenticated and how to extend safely
type: feature
---
- `anon` role has NO direct SELECT on `public.portals`. The RLS policy `Members can view published portals` is `TO authenticated` only.
- Anonymous reads MUST go through the `public.portals_public` view. It selects only safe display columns and sanitizes `telegram_config` to `{ groupLink, vipLink, botUsername, brand }`.
- Excluded from the view (never leaked to anon): `brief`, `metadata`, `paid_services`, `halalify`, `published`, `created_by`, `brief_version`, `brief_updated_at`, `tg/internal config keys`.
- Routes that load portals as anon (SSR/public): `p.$slug`, `m.$slug`, `td.$slug`, `trade`, `sitemap[.]xml` — all read `portals_public`.
- Authenticated client reads (history, dashboard, boss.*, server functions) keep using `portals` directly under the existing RLS policies (creators, boss, admin, members-of-published).
- Adding a new public-facing column: add it to the `portals_public` view definition in a new migration. NEVER grant anon SELECT on `public.portals` columns directly.
- The view is `security_invoker = false` by design (Supabase linter flags this as "Security Definer View" — accepted: the view's whole purpose is sanitized projection with WHERE published=true).
