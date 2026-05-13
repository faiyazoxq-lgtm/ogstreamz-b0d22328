## Stream-Profile Credential Bot

When a user buys a stream-profile pass, the boss gets a Telegram card with the member's profile and a "Send Credentials" button. Tapping it walks the boss through `username` then `password` via Telegram's force-reply prompts. On send: credentials are encrypted, stored on the user, DM'd to the member, mirrored into their dashboard, and the member's profile is flagged with the new "OG-Streamz member" tier.

---

### 1. Database (one migration)

**`profiles.member_tier`** — new text column (nullable, values like `og_streamz_member`). Used to render the "OG-STREAMZ MEMBER · BELOW VIP STATUS" badge anywhere ranks/tags appear.

**`pass_orders`** — add three columns to drive the boss-reply state machine:
- `boss_chat_id bigint` — which boss chat is currently filling in this order
- `boss_draft_state text` — `idle` | `awaiting_username` | `awaiting_password` | `delivered`
- `boss_draft_username text` — temp staging while waiting for password (cleared after delivery)

Credentials at rest reuse the existing `stream_account_links` table (encrypted `bytea` columns). No new credential storage table.

**RPC `boss_record_stream_credentials(order_id, username, password)`** — security definer. Encrypts via existing `pgp_sym_encrypt`, upserts `stream_account_links` for the user, sets `profiles.member_tier='og_streamz_member'`, marks the order `delivered`.

### 2. Server library — `src/lib/stream-credential-bot.server.ts`

Single file owning all bot logic. Three entry points, all called from existing routes:

- `notifyBossOfStreamRequest(orderId)` — pre-payment heads-up card. Plain text, no buttons. "🟡 Pending payment from {name} · {email} · {product}".
- `notifyBossOfStreamPurchase(orderId)` — post-payment actionable card. Includes member avatar (Telegram `sendPhoto`), display name, email, rank, current member_tier, product/duration, Stripe ref. Inline keyboard: `[ Send Credentials ]` with `callback_data = creds:start:<orderId>`.
- `handleCredsCallback(cb)` — answers the callback, marks order `awaiting_username`, sends a force-reply prompt: *"👤 Reply with the USERNAME for order {short id}"*. The order id is encoded in the prompt text so we can recover it from `reply_to_message`.
- `handleBossCredsReply(msg)` — on any boss reply whose `reply_to_message.text` matches our prompt format, extracts the order id + state, validates, stores, and either:
  - if state was `awaiting_username` → save to `boss_draft_username`, send the password prompt
  - if state was `awaiting_password` → call the RPC, DM the member their creds + a "view in dashboard" link, confirm to boss, clear draft

### 3. Wire-ups (no logic in routes)

- `src/routes/api/public/payments/webhook.ts` — after the existing `pass_orders` upsert for `streams_pass`, await `notifyBossOfStreamPurchase(orderId)`. The pre-payment alert fires from the existing checkout-creation server fn (`pass-checkout.functions.ts`) once the order row pre-exists, or if not, we add it after Stripe `checkout.session.created`. Choice in implementation: simplest is to fire `notifyBossOfStreamRequest` from the existing checkout server fn right after `stripe.checkout.sessions.create` succeeds.
- `src/routes/api/public/telegram/webhook.ts` — extend the existing handler to route:
  - `update.callback_query` → `handleCredsCallback`
  - boss messages with `reply_to_message` matching our prompt → `handleBossCredsReply` (runs before the existing generic boss-reply DM logic so the prompt-reply isn't sent to a member by mistake)

### 4. Member-side delivery

- **Telegram DM**: pulled from `telegram_user_links.chat_id`. Message format: bold heading "🎬 Your stream credentials", then `<code>username</code>` / `<code>password</code>` blocks, footer "View any time in your dashboard ↗".
- **Dashboard surface**: a new `<StreamCredentialsCard>` on `/dashboard` that calls a new `getMyStreamCredentials` server fn (auth-required, decrypts via `pgp_sym_decrypt`, returns plain creds only to the owning user). One-click copy buttons; never logged.

### 5. Member-tier badge

Render `OG-STREAMZ MEMBER · BELOW VIP STATUS` wherever rank chips appear when `profiles.member_tier === 'og_streamz_member'` and rank isn't `vip` / `boss`. Three call-sites only: the profile card on the boss queue, the user dashboard header, and the small chip in the site nav.

### 6. Out of scope

- Rotating/changing creds after delivery (boss can re-send; member has no self-serve change yet).
- Multiple stream accounts per user (current `stream_account_links` is unique on `user_id`).
- Audit log of who saw the creds (can add later).

---

### Files touched

**New**
- `src/lib/stream-credential-bot.server.ts`
- `src/lib/stream-credentials.functions.ts` (auth-protected `getMyStreamCredentials`)
- `src/components/StreamCredentialsCard.tsx`
- One migration file

**Edited**
- `src/routes/api/public/payments/webhook.ts` (add notify call)
- `src/routes/api/public/telegram/webhook.ts` (add callback_query + reply routing)
- `src/lib/pass-checkout.functions.ts` (add pre-payment notify)
- `src/routes/dashboard.tsx` (mount the credentials card)
- 2–3 small UI files for the member-tier badge
