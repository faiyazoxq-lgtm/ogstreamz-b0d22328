## Goal

Replace the "Copy to Suno" flow with end-to-end generation. When the user picks a style, we kick off Suno (which returns 2 versions by default), preview both for 30 seconds free, then charge 2 credits to unlock the full MP3 download or share to socials.

## Changes

### 1. Database (migration)

`suno_jobs` currently only stores one `audio_url`. Suno returns 2 clips per task.

- Add `audio_url_v1 text` and `audio_url_v2 text` columns (keep existing `audio_url` for back-compat, set it to v1).
- Add `image_url_v1 text`, `image_url_v2 text`.
- Add `download_unlocked_at timestamptz` (when user spent 2 credits to unlock).

### 2. Suno webhook (`src/routes/api/public/suno-webhook.ts`)

- Stop using `pickFirstClip`; instead pick the first 2 clips with audio and store them as `audio_url_v1` / `audio_url_v2`. Keep mirroring v1 to existing `audio_url` for the rest of the app.

### 3. New server functions (`src/lib/music-portals.functions.ts`)

- `generatePortalTrack({ slug, style })` — auth-required. Builds the stack (existing logic), then calls Suno `spawnMusic` with the stack's `formatted` prompt + `timbre` tags + portal title. Returns `{ jobId, taskId }`. Charges 1 credit (the existing stack credit covers the spawn).
- `getPortalTrackJob({ jobId })` — auth-required. Returns `{ status, audio_url_v1, audio_url_v2, image_url, download_unlocked }`. v1/v2 always returned (server doesn't gate previews — client will cap them at 30s).
- `unlockPortalTrackDownload({ jobId })` — auth-required. Charges 2 credits via `spend_credits` RPC (`reason: 'suno-download'`), sets `download_unlocked_at`. Returns `{ audio_url_v1, audio_url_v2 }` (same URLs but now marked unlocked).

### 4. UI (`src/routes/m.$slug.tsx`)

Replace the current Stack section's "Copy to Suno" flow:

- Click a style preset → calls `generatePortalTrack` → shows "Generating your track…" with a progress shimmer.
- Poll `getPortalTrackJob` every 4s until `status='complete'` and both audio URLs land (or 5 min timeout with retry).
- Render 2 audio cards ("Version A" / "Version B"), each with `<audio>` tag. Use a `timeupdate` listener that pauses + resets to 0 once `currentTime >= 30` to enforce the free preview cap. Show a small "🔒 30s preview" badge.
- Below: a single primary CTA — **"Unlock Full Track (2 credits)"**. On click → `unlockPortalTrackDownload` → on success, remove the 30s cap, swap CTA into two buttons: **"Download MP3"** (per version, triggers `<a download>` from the audio URL) and **"Share"** (uses Web Share API with the URL; falls back to a copy-to-clipboard toast on desktop).

### 5. Cost registry

- Add `suno-download: 2` to `src/lib/cost-registry.ts` so the credit charge is visible.

## Out of scope

- Server-side audio trimming (we cap previews client-side via `<audio>` listener — simpler and free).
- Re-encoding to MP3 if Suno returns MP4/M4A (Suno already serves MP3).
- Direct cross-posting to TikTok/IG (Web Share API is the standard mobile-native handoff).

## Notes

- The webhook secret + `SUNO_API_KEY` are already configured (existing `spawnMusic` works in other parts of the app).
- Realtime is already enabled on `suno_jobs` — we could subscribe instead of polling, but polling is simpler and more reliable for a first pass.
