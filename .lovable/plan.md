## Goal

Every portal you spawn becomes a marketable, monetizable asset:
- Visitors hear a **60-second preview** of the song.
- Full download is gated behind a **VIP unlock-all subscription**.
- The moment a portal spawns, the agent expands the prompt, picks an audience, and ships marketing to **Telegram VIP channel + public SEO landing + Apollo cold outreach** — no manual approval.

## What gets built

### 1. VIP subscription (Stripe)

- `enable_stripe_payments` (built-in Stripe, embedded checkout — no BYOK).
- One product: **0G-Syndicate VIP** with two prices: `vip_monthly` ($19) and `vip_yearly` ($149).
- New route `/vip` with `<StripeEmbeddedCheckout />`, plan toggle, and `<PaymentTestModeBanner />`.
- Standard `subscriptions` table + `payments-webhook` route (per Stripe knowledge).
- `useSubscription` hook + `isVip = subscription.status in (active, trialing) || profile.status='vip' || isAdmin`.

### 2. 60-second preview + paywalled download

- New server fn `prepareTrackAssets` triggered from the existing `suno-webhook` once the MP3 lands:
  - Fetches the full MP3, uses `ffmpeg`-free pure-JS trim via byte-range + a tiny WebAudio-less re-encode is not viable in Worker — so we trim by **time-window playback enforcement client-side** (HTML5 `<audio>` with `currentTime` cap at 60s + locked seek bar) AND store full file in private `tracks` bucket. Preview public URL = same MP3, the player enforces the cap. Acceptable trade-off: file is private; only the player streams it via signed URL with `Range` clipping enforced on a server fn.
  - Cleaner option: store full file private; expose `getPreviewStream` server fn that pipes only the first ~60s worth of bytes (approximate via bitrate from MP3 header) via a Response stream. Non-VIP gets preview stream, VIP gets a signed URL to full file.
- New table `portal_assets` is unnecessary — extend `tracks` (already has `preview_path`, `full_path`, `price_cents`). Make `tracks` rows the canonical asset, link to `portals.slug`.
- Portal page (`p.$slug.tsx` / `m.$slug.tsx`) gets a `<TrackPlayer>` that:
  - Streams via `/api/public/track-stream/$id?mode=preview|full`.
  - `mode=full` returns 402 unless caller has active VIP sub.
  - "Download MP3" button calls a server fn that returns a one-time signed URL — VIP only.

### 3. Auto-marketing on spawn (the "expanded prompt + audience" engine)

Wire into the existing portal spawn path (music-spawn / jokes spawn / power-pack):

**Step A — Expand prompt + pick audience (Gemini 2.5-flash, structured JSON):**
```
Input: { originalPrompt, niche, vibe, kind }
Output: {
  expandedPitch: string,        // 2-paragraph marketing pitch
  audienceICP: string,          // "indie hip-hop fans 18-30, NYC/ATL"
  apolloFilters: { titles[], industries[], locations[], keywords[] },
  emailSubject: string,
  emailBody: string,            // cold email referencing the song
  telegramCaption: string,      // <500 chars, Telegram-flavored
  seoTitle: string,             // <60 chars
  seoDescription: string,       // <160 chars
  hashtags: string[]
}
```

**Step B — Persist:** write `seo_title/seo_description/seo_image_url/seo_refreshed_at` onto `portals`. Mirror in `head()` of portal route.

**Step C — Telegram broadcast:** post `telegramCaption` + portal URL + audio preview to `bot_configs.channel_chat_id` (existing VIP channel) via `tgSend("/sendAudio")`.

**Step D — Apollo cold outreach:** insert a `connect_campaigns` row with `icp`, `offer`, `target_url`, `scout_summary`. Existing connect machinery picks it up. (Apollo lead pull + Instantly send already exist in `src/lib/`; we just queue the campaign.)

All four steps run in parallel inside a single `runPortalMarketing(portalId)` server fn, called from `spawnPortal`/`runPowerPack`. Failures log but never block portal creation.

### 4. Schema changes (one migration)

- New table `portal_marketing` — one row per portal:
  `portal_id`, `expanded_pitch`, `audience_icp`, `apollo_filters jsonb`, `email_subject`, `email_body`, `telegram_caption`, `hashtags text[]`, `status` (`pending`/`shipped`/`failed`), `telegram_message_id`, `campaign_id`, `created_at`, `updated_at`.
- Make `tracks` bucket policies: public can read **preview_path** only; full_path requires VIP sub (enforced via signed URL server-side, not RLS).
- Add `subscriptions` table per Stripe knowledge.

### 5. UI surfaces

- `/vip` — pricing page + embedded checkout.
- `/dashboard` — add VIP status pill + "Manage subscription" → portal session.
- Each portal page — replace plain `<audio>` with `<TrackPlayer mode={isVip ? "full" : "preview"} />` + "Unlock with VIP" CTA.
- `/syndicate` — show `portal_marketing.status` next to each spawned pack.

## Technical details

- **Server runtime:** byte-window streaming uses `ReadableStream` + `fetch(..., { headers: { Range } })` against Supabase storage signed URL. Worker-safe.
- **Preview duration enforcement:** server reads first 12 frames of MP3 to estimate bitrate, then byte-clips the response to `~bitrate * 60s`. Imperfect but no native deps. If bitrate unknown, fall back to 1 MB cap.
- **Subscription gate:** server fn `requireActiveVip` middleware reads `subscriptions` joined with `profiles.status='vip'` for the calling user.
- **Apollo + Instantly:** already wired (`connect_campaigns`, `connect_leads`, `connect_sending_domains`). The marketing fn only writes the campaign row; the existing flow handles fanout.
- **Telegram:** uses the connector gateway pattern already used in `power-pack.functions.ts`.

## Open question before I start

The build will need me to call `enable_stripe_payments` (sets up Stripe sandbox + webhook secret automatically — you don't paste any keys). After it runs you'll see a "claim Stripe sandbox" link in Cloud → Payments to claim it later for live mode.

**Reply "go" and I'll execute the whole plan in sequence:**
migration → enable_stripe_payments → products/prices → checkout & subscription → preview streaming → marketing chain → wire into spawns.
