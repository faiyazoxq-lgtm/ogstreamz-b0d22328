# Encrypted Records + Dual-Store Ledger

## Goal

Every record in the app becomes opaque ciphertext at rest. Each write is mirrored to a second independent store, and every read fetches both copies and rejects mismatches. Decryption keys live only in server secrets — never in the browser, never in plain DB columns.

## Architecture

```text
Browser  ──auth token──▶  createServerFn (Worker)
                              │
                              ├─▶ Primary store:  public.* tables (pgp_sym_encrypt columns)
                              └─▶ Mirror store:   public.ledger_mirror (separate schema, JSONB ciphertext + hash chain)

Read path:
  fetch(primary) + fetch(mirror)  ──▶  decrypt both  ──▶  hash compare  ──▶  return / raise tamper alert
```

- **Encryption**: `pgp_sym_encrypt(plaintext, key)` with AES-256 inside a SECURITY DEFINER function. Keys come from `MASTER_DATA_KEY` (new Supabase secret) loaded into a server-only `_data_key` table at boot.
- **Mirror store**: new `ledger_mirror` table — `(record_id, table_name, version, ciphertext bytea, prev_hash bytea, row_hash bytea, written_at)`. Append-only, hash-chained, RLS denies all client access.
- **Cross-check**: every read goes through a SECURITY DEFINER fn (`read_record(table, id)`) that pulls primary + mirror, decrypts, hashes, and raises if they diverge.
- **No tracing**: drop `created_at` precision to day-bucket on encrypted tables; no IP / UA logging; ledger row hashes use HMAC so only key-holders can correlate.

## Scope (per your answer: everything)

Tables to convert — encrypt all non-key columns, keep only `id`, `user_id` (for RLS), `created_at` (day-bucket):

- `profiles`, `user_roles`, `credit_ledger`, `credit_purchases`, `vip_passes`, `vip_pass_pool`, `vip_pass_reveals`
- `portals`, `portal_brief_versions`, `portal_view_events`, `trade_scans`
- `pass_orders`, `topup_requests`, `redeem_codes`, `redemptions`, `pending_credit_grants`
- `stream_account_links` (already encrypted), `stream_verification_requests` (already encrypted), `vault_credentials` (already encrypted)
- `signup_passes`, `signup_pass_claims`, `subscriptions`, `reseller_accounts`, `reseller_credit_ledger`
- `telegram_user_links`, `vip_notifications`, `civility_settings`, `analytics_settings`

That's ~25 tables. Every read path in the app (server functions, RLS policies, triggers, RPC functions like `spend_credits`, `redeem_code`, `boss_*`) has to be rewritten to call the encrypted accessors instead of selecting columns directly.

## Implementation phases

### Phase 1 — Foundation (1 migration)
- Add `MASTER_DATA_KEY` secret.
- Create `_data_key` table (service-role only) + `_data_secret()` accessor (mirrors existing `_stream_link_secret`).
- Create `ledger_mirror` table with hash-chain trigger.
- Create generic helpers: `enc_write(table, id, payload jsonb)`, `enc_read(table, id) returns jsonb`, `enc_verify(table, id) returns boolean`.

### Phase 2 — Convert one table end-to-end as proof (credit_ledger)
- Add `enc_payload bytea` column, backfill from existing columns, drop plaintext columns.
- Rewrite `spend_credits`, `admin_adjust_credits`, etc. to `enc_write` + mirror.
- Rewrite the credits UI server fn to use `enc_read` with cross-check.
- Verify the credits page still works end-to-end.

### Phase 3 — Roll out to remaining 24 tables
- One migration per table family. Each: add encrypted column, backfill, rewrite RPCs, drop plaintext, update server fns.

### Phase 4 — Lock down
- Revoke all direct `SELECT` grants on the converted tables; force everything through SECURITY DEFINER accessors.
- Add `enc_verify_all()` cron that walks the ledger nightly and alerts on mismatch.

## Trade-offs you need to know about

| Cost | Impact |
|---|---|
| **No SQL filtering / sorting on encrypted fields** | Search by email, sort by date, "where status = 'pending'" all break. Either keep an HMAC index (leaks equality) or load + filter in the server fn (slow above ~1k rows). |
| **2× write cost, 2× storage** | Every insert/update hits primary + mirror. Roughly doubles DB load. |
| **2× read latency** | Both copies fetched + decrypted before responding. Add ~50–150ms per query. |
| **Realtime subscriptions break** | The frontend can't subscribe to `postgres_changes` anymore — payloads are ciphertext. Replace with polling or a server-fn re-broadcast. |
| **Boss/admin dashboards need rewriting** | `boss_list_stream_links`, `boss_list_vault_credentials`, every leaderboard and analytics view decrypts row-by-row — pagination becomes mandatory. |
| **Single secret = single point of failure** | You picked Lovable Cloud secrets. If that key leaks or is lost, all data is unreadable. No recovery. Recommend backing up `MASTER_DATA_KEY` offline the moment it's generated. |
| **"No tracing" is partial** | Postgres still has WAL, audit logs, and connection logs. True untraceability requires moving the DB off Lovable Cloud — which you said no to. |

## What I will NOT do without explicit confirmation

- Touch `auth.users` (Supabase-managed, can't be encrypted).
- Drop the existing `email` column on `profiles` — auth flow needs it. Will encrypt a `display_email` shadow column instead.
- Remove created_at entirely (RLS and ordering depend on it) — only round to day.

## Recommendation

Start with **Phase 1 + Phase 2** only. That gets the encryption + mirror plumbing in place and proves it on `credit_ledger` (lowest blast radius). After you confirm it works, we roll out to the rest one family at a time. Doing all 25 tables in one shot will almost certainly break something silently.

Confirm and I'll start with Phase 1 (foundation migration) + Phase 2 (credit_ledger conversion).
