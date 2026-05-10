## Goal
Reduce the personal data we keep in plaintext on the server. Today, stream credentials are already encrypted in `stream_account_links`, but the upstream **`stream_verification_requests`** queue still stores the IPTV username, server URL, and the raw provider payload as plaintext (the password is scrubbed only after Boss decides). This plan encrypts that queue and tightens retention.

Stream **status** and **expiry timestamp** (no credentials) stay in plaintext on `profiles` — the member UI needs them to show "Active / Expires in 3d", and they aren't PII on their own. Email is needed by Supabase auth, so it stays as-is.

## Changes

### 1. Encrypt the verification queue
- Add `enc_username bytea`, `enc_server bytea`, `enc_password bytea`, `enc_payload bytea` to `stream_verification_requests`.
- Migrate existing rows into the encrypted columns using `pgp_sym_encrypt` with the existing `_stream_link_secret()` key.
- Drop plaintext `username`, `password`, `server`, `auto_payload` columns.
- Lock the table down: revoke direct SELECT — Boss reads only via a SECURITY DEFINER RPC (below).

### 2. New / updated RPCs
- `enqueue_stream_verification(...)` — encrypt all four fields on insert.
- `boss_decide_stream_request(...)` — decrypt to call `boss_link_stream_account`, then immediately wipe `enc_password` (and after 7 days also `enc_username` / `enc_server` / `enc_payload` via cleanup job below).
- New `boss_list_stream_requests(_status text)` — returns decrypted rows joined with profile email/rank for the queue UI. Boss/admin only.

### 3. Auto-purge
- After a decision is recorded, `enc_password` is cleared straight away.
- Add a `purge_stream_verification_requests()` function: deletes any decided/superseded row older than 30 days, and clears all encrypted fields on rows older than 7 days post-decision (keeps row for audit but no recoverable PII).

### 4. UI
- `src/routes/boss.stream-queue.tsx` switches from `supabase.from(...).select(...)` to `supabase.rpc("boss_list_stream_requests", { _status: tab })`.
- Same render shape — `Req` type unchanged.

### 5. Out of scope
- `profiles.stream_status` / `stream_expires_at` / `stream_verified_at` (non-credential status only) — kept plaintext.
- `profiles.email` (auth requirement) — kept plaintext.
- `stream_account_links` — already encrypted, no change.

## Files touched
- New migration: encrypt queue columns + new RPC + purge function.
- `src/routes/boss.stream-queue.tsx` — switch to RPC.
- `src/integrations/supabase/types.ts` — auto-regenerated.

No client component changes (StreamLinkCard, member UI) — the member side never touched the raw queue.
