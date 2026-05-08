# 0G-Syndicate Mesh — Build Plan

## Reality check (read first)

Two pieces of the brief can't be built as described. I'll flag them now so we don't burn cycles:

- **Wix GUI Agent / "browse my Wix dashboard"** — Lovable's server runtime is a Cloudflare Worker. It has no headless browser, no Puppeteer, no `child_process`. There is no way for an agent to "browse" Wix and click around. The realistic alternative: if your portals already live on Lovable, we update **their own** SEO meta tags (title/description/og:image) automatically when Trade signals change — no Wix needed. If you must update Wix, you need the **Wix REST API** with a Wix API token (separate integration), not a GUI agent.
- **Stripe Treasury → virtual debit cards** — Treasury is invite-only, US-only, and requires you to be an approved Stripe Connect Platform with a signed Treasury agreement. We can build a `/wallet` route that shows 0G-Credits, top-up via the existing Stripe checkout, and a "Card coming soon — join waitlist" CTA. Real card issuance is a months-long compliance process, not a feature toggle.

Everything else is buildable. Proposed scope below.

## Phase 1 — Power Pack Orchestrator (the core ask)

New server function `runPowerPack({ asset, bias, command })` in `src/lib/orchestrator.functions.ts`. Sequence:

1. **Scout** — Perplexity `sonar` with `search_recency_filter: 'day'`, asset-specific query. Returns 5 headlines + citations.
2. **Reason** — Gemini 2.5-flash with high thinking, fed the headlines, returns a structured JSON: `{ summary, bullCase, bearCase, anthemPrompt, videoPrompt, telegramCaption }`.
3. **Produce in parallel**:
   - Veo: `videogen--generate_video` using `videoPrompt` (1080p, 16:9, 5s).
   - Suno: existing `spawnMusic` with `anthemPrompt` + asset-tagged style.
4. **Persist** — insert a `power_packs` row (asset, bias, summary, headlines, video_url, suno_task_id, telegram_status).
5. **Broadcast** — Telegram gateway `sendMessage` (caption) + `sendVideo` (when Veo finishes) + `sendAudio` (when Suno webhook lands) to the VIP channel from `bot_configs.channel_chat_id`.

New tables (one migration):
- `power_packs` — id, user_id, asset, bias, command, summary, headlines (jsonb), video_url, suno_task_id, suno_audio_url, telegram_message_id, status, created_at.
- Extend existing `suno_jobs` with `power_pack_id` FK so the suno-webhook can chain the Telegram broadcast.

UI: new `/syndicate` route — single big input "Boss, give the order…", recent Power Packs feed, status pills (Scouting → Reasoning → Producing → Broadcast).

## Phase 2 — TradeHUB live news on portal spawn

Extend `td.$slug` (Trade portal) loader / a `getLiveTradeNews(asset)` server fn:
- Perplexity `sonar`, `search_recency_filter: 'hour'`, returns top 5 with citations.
- Cache in `portals.scout_meta` for 5 min to avoid burning credits.
- Render a "Live Wire" panel on the trade portal that auto-refreshes every 60s via `useQuery`.

## Phase 3 — Live Sync glow (the unified pulse)

- New table `market_pulse` — single row per asset: `asset`, `price`, `direction` ('up' | 'down' | 'flat'), `delta_pct`, `updated_at`. Updated by a cron (existing bot infra) or on-demand from TradeHUB.
- New `<MarketPulseProvider>` mounted in `__root.tsx`. Subscribes to `market_pulse` realtime channel for the user's "watched asset" (default Gold).
- Sets a CSS variable `--pulse-hue` on `<html>`: green oklch when up, red when down, neutral when flat. Existing tokens (gold accents, borders) blend with `color-mix(in oklab, var(--pulse-hue) 20%, ...)`.
- Subtle animated breathing border on hub cards driven by the same hue.

## Phase 4 — /wallet route (scoped honestly)

- Route `/wallet` shows: current 0G-Credits (from `profiles.credits`), credit ledger history (from `credit_ledger`), top-up CTA → existing Stripe checkout, recent purchases.
- A dimmed "Syndicate Card" placeholder section: "Virtual debit card — apply for early access" with an email-capture button into a new `card_waitlist` table.
- **No Treasury integration.** I'll add a code comment + memory note explaining why and what would be required to revisit.

## Phase 5 — Auto-SEO on Lovable portals (replacement for the Wix piece)

When a portal is spawned or its `scout_meta` refreshes, regenerate its `head()` meta:
- Pull current trending headline from `scout_meta`.
- Update the portal's stored `theme_config.seoTitle` / `seoDescription` / `seoImage`.
- `head()` reads from those fields so each portal's social cards reflect today's trending angle.

This is the actual "autonomous SEO" — and it works because we own the portals.

## Technical notes

- All API calls server-side via `createServerFn` (Perplexity, Gemini, Telegram gateway). No keys in client.
- Veo via `videogen--generate_video` (Lovable AI). Suno already wired.
- Telegram via existing connector gateway (`TELEGRAM_API_KEY`).
- Power Pack chaining: suno-webhook checks `power_pack_id`, if present and video is ready, fires the final Telegram broadcast.

## What I need from you before I build

This is 5+ days of work in one prompt. Please pick the priority order — I'll execute Phase 1 first by default unless you say otherwise. Also confirm:

1. Should the Telegram broadcast go to the existing `bot_configs.channel_chat_id` (Gold bot), or a new dedicated VIP channel ID?
2. For Live Sync, which asset is the "master pulse" by default — Gold, or per-user pick?
3. /wallet — confirm you accept "no real Treasury card yet, waitlist only"?
