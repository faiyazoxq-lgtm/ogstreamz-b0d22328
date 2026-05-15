---
name: Vault re-auth gate
description: Server-side enforcement of vault credential reveal — VaultGuard is UX only
type: feature
---
- `VaultGuard` (sessionStorage `vault:unlocked` flag) is **UX only** — it can be bypassed by any browser user. Do NOT treat it as a security boundary.
- Real enforcement lives in `src/lib/vault.functions.ts` → `revealVaultCredential`. A caller may reveal a vault credential ONLY if:
  - `profiles.rank` is `vip` or `boss`, OR
  - the caller holds the `admin` role in `user_roles`, OR
  - `profiles.rank = 'stream_user'` AND `profiles.stream_verified_at` is within the last 12 hours.
- `stream_verified_at` is set by `tagOgStreamzUser()` on successful `vaultPortalLogin` (or `m3u_fetch`). It is the proof-of-vault-access signal.
- Re-auth window: 12h. If you change it, update both the constant in `revealVaultCredential` and this note.
- Do NOT downgrade `revealVaultCredential` to plain `requireStrictAuth` without re-adding the rank+freshness check.
