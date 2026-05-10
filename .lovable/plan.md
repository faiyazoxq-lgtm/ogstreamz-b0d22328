# Plan — Convert /store into a full Member Store

## 1. Store shell (`/store`)

Refactor `src/routes/store.tsx` into a tabbed catalog:

```text
┌──────────────────────────────────────────────────┐
│ Credits │ VIP Passes │ Streams │ Products │ NFTs │
└──────────────────────────────────────────────────┘
```

- **Credits** — existing flow, unchanged.
- **VIP Passes** — 7 / 30 / 90 day tiers, Stripe checkout → Boss approval → auto-issued pass.
- **Streams Passes** — same engine as VIP passes but `kind = 'streams'`, grants room access only (no full-VIP perks).
- **Products** — digital downloads / unlocks. Reuses the existing `track_purchases` pattern; adds a generic `store_products` table for things that aren't tracks.
- **NFTs** — render a "Coming Soon — join waitlist" panel that writes into existing `card_waitlist` (`tier='nft'`).

Each tab is its own component under `src/components/store/`: `CreditsTab.tsx`, `VipPassesTab.tsx`, `StreamsPassesTab.tsx`, `ProductsTab.tsx`, `NftComingSoonTab.tsx`.

## 2. Database changes (one migration)

```sql
-- New: catalog of products available in the store (admin-managed)
create table public.store_products (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  kind text not null check (kind in ('vip_pass','streams_pass','digital','nft')),
  title text not null,
  description text,
  image_url text,
  price_cents integer not null,
  currency text not null default 'usd',
  -- vip/streams: number of days the pass lasts
  duration_days integer,
  -- digital: optional file/url delivered after purchase
  asset_url text,
  metadata jsonb not null default '{}',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- RLS: public read for active rows, boss writes.

-- New: every paid order that needs Boss approval (VIP/Streams passes)
create table public.pass_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  product_id uuid not null references public.store_products(id),
  kind text not null,                       -- vip_pass | streams_pass
  duration_days integer not null,
  amount_cents integer not null,
  currency text not null default 'usd',
  stripe_session_id text unique not null,
  environment text not null default 'sandbox',
  status text not null default 'pending_approval',
    -- pending_approval | approved | denied | issued
  pass_number text,                          -- e.g. "VIP-000123"
  issued_pass_id uuid references public.vip_passes(id),
  boss_decision_note text,
  decided_by uuid,
  decided_at timestamptz,
  telegram_alert_msg_id text,                -- to edit the Boss alert in-place
  user_chat_id bigint,                       -- snapshot at order time
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- RLS: user reads own; boss reads/updates all.

-- New: per-user Telegram link (chat_id) + opt-in
create table public.user_telegram_links (
  user_id uuid primary key,
  chat_id bigint not null,
  username text,
  first_name text,
  linked_at timestamptz not null default now()
);
-- One-time deep-link tokens
create table public.telegram_link_tokens (
  token text primary key,                    -- random base32, 12 chars
  user_id uuid not null,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  consumed_at timestamptz
);
-- RLS: user reads/inserts own; service role does the linking write.

-- Sequence so pass numbers are monotonic and unique
create sequence public.vip_pass_serial start 1000;
```

A SECURITY DEFINER RPC `boss_decide_pass_order(_order_id, _approve, _note)`:
- enforces `is_boss(auth.uid())`
- if approve: pulls next `nextval('vip_pass_serial')` → builds `pass_number = 'VIP-' || lpad(...,6,'0')` (or `STR-` for streams), inserts into `vip_passes` with the right `expires_at = now() + duration_days`, updates `profiles.status = 'vip'` (VIP passes only), updates the order row with `status='issued'`, returns the `pass_number` + `chat_id` so the caller can DM.
- if deny: marks order denied; the Telegram callback handler then refunds via Stripe.

## 3. Stripe checkout (reuses existing pattern)

Add `src/lib/store-checkout.functions.ts`:

- `createPassCheckout({ productId })` — looks up `store_products` row, creates a Stripe checkout session with metadata `{ kind, product_id, user_id, duration_days }`, return URL `/store/return?session_id={CHECKOUT_SESSION_ID}`.
- `createDigitalCheckout({ productId })` — same but metadata `{ kind: 'digital' }`.

Webhook handler (`src/routes/api/public/stripe-webhook.ts` if it doesn't already split by kind — extend it):

- On `checkout.session.completed`:
  - `kind === 'vip_pass' | 'streams_pass'` → insert `pass_orders` row with `status='pending_approval'`, snapshot `user_chat_id` from `user_telegram_links`, then call the Telegram alert helper (see §5).
  - `kind === 'digital'` → grant immediately, write to `credit_purchases`-style ledger, DM receipt if linked.

## 4. Telegram link flow

New page section in `src/routes/profile.tsx` (and the new Store header):
- "Connect Telegram" button → calls server fn `createTelegramLinkToken()` → returns `t.me/<bot_username>?start=<token>`.
- User taps → bot's `/start <token>` handler is added to the **existing** `src/routes/api/public/telegram/webhook.ts`:
  - look up token, ensure not expired/consumed, write to `user_telegram_links` (chat_id from update), reply "✅ Linked to OG-STREAMZ".

`<TelegramLinkBadge />` component shows status (Linked / Not linked) and lives in the Store header so checkout flows can warn before paying.

## 5. Boss approval over Telegram

Extend the same webhook to handle:

1. **Outbound alert** (helper `notifyBossNewPassOrder(order)`):
   ```
   🛂 New VIP Pass Order
   • User: @handle (uid …)
   • Tier: 30-day VIP — $49
   • Order: <order_id>
   [✅ Approve] [❌ Deny]
   ```
   Uses `sendMessage` with `inline_keyboard` callback_data `approve:<order_id>` / `deny:<order_id>`. Stores returned `message_id` on `pass_orders.telegram_alert_msg_id`.
   Boss chat_id comes from `BOSS_TELEGRAM_CHAT_ID` (new secret) or — fallback — looks up the boss user's `user_telegram_links` row.

2. **Inbound `callback_query`** in the webhook:
   - Verify the sender is the boss (chat_id matches boss link).
   - Call `boss_decide_pass_order` RPC via service role.
   - On approve: `editMessageText` the original alert to `✅ Approved — VIP-001234`; then `sendMessage` to the user's chat_id with the styled pass receipt + serial.
   - On deny: `editMessageText` to `❌ Denied`, refund via Stripe (`refunds.create`), DM user with the bad news.

If boss isn't linked yet, fall back to a `boss_chat_messages` row + an admin inbox panel at `/syndicate-overlord` so nothing is lost.

## 6. New secret

Add **`BOSS_TELEGRAM_CHAT_ID`** so alerts work even before the boss links via deep-link. (We already have `TELEGRAM_API_KEY` via the connector.)

## 7. UI: showing the pass back to the user

- After return from Stripe, `/store/return` polls `pass_orders` (and subscribes via realtime) until `status='issued'`, then renders a printable pass card with serial, expiry, QR (encodes `pass_number`).
- Profile page gets a **"My Passes"** section listing every `vip_passes` row joined to its source `pass_orders` (so the serial + delivery channel are visible).

## 8. Files to create / edit

**New**
- `supabase/migrations/<ts>_store_v2.sql` (everything in §2)
- `src/lib/store-checkout.functions.ts`
- `src/lib/telegram-link.functions.ts` (`createTelegramLinkToken`, `getMyTelegramLink`)
- `src/lib/pass-orders.functions.ts` (`getMyPassOrders`, realtime helper)
- `src/lib/telegram-notify.server.ts` (boss alert + user DM helpers)
- `src/components/store/{StoreTabs,CreditsTab,VipPassesTab,StreamsPassesTab,ProductsTab,NftComingSoonTab,PassCard,TelegramLinkBadge}.tsx`
- `src/routes/store.return.tsx` (or extend existing `/checkout/return`)

**Edit**
- `src/routes/store.tsx` — replace contents with `<StoreTabs />`
- `src/routes/api/public/stripe-webhook.ts` — branch on `kind` metadata
- `src/routes/api/public/telegram/webhook.ts` — handle `/start <token>` + `callback_query`
- `src/routes/profile.tsx` — add "My Passes" + Telegram link badge
- `src/components/NavBar.tsx` — Store dropdown gets a "My Passes" entry

## 9. Out of scope this round

- NFT minting / wallets — only the "Coming Soon + waitlist" tab ships.
- Refund UI in admin panel — refunds happen automatically on Boss-deny via Stripe; no new admin screen.
- Multi-currency — everything stays USD for now.

## 10. What I'll need from you mid-build

After the migration is approved, I'll request the **`BOSS_TELEGRAM_CHAT_ID`** secret (just paste your Telegram numeric chat id — the bot will print it the first time you `/start` it, or I can add a `/whoami` command).
