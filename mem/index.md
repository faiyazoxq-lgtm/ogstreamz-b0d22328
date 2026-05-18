# Memory: index.md
Updated: today

# Project Memory

## Core
All credentials/secrets MUST be stored in Supabase (encrypted at rest via pgp_sym_encrypt or service-role-only tables). Never persist credentials in localStorage, sessionStorage, cookies, or plain client-readable DB columns. Browser may only hold short-lived Supabase auth session tokens.
Data minimization: store the smallest possible set of user fields; encrypt anything sensitive so it can be decrypted server-side later for sorting/analytics.
Gold/metal accents must use `--og-gold-*` and `--og-metal-ink` tokens — never hardcode oklch gold values.

## Memories

- [Portals column ACL](mem://features/portals-column-acl.md) — Which `public.portals` columns are readable by anon vs authenticated and how to extend safely
- [Hub access grant](mem://features/hub-access-grant.md) — `/hub/*` is boss-only plus a per-user `profiles.hub_access` toggle managed from OG-Passes
- [OG gold halo tokens](mem://design/og-gold-tokens.md) — Shared CSS variables for the OG PORTAL electric-gold and metallic halo palette
