## What you already have (no work needed)

I checked the codebase carefully — the bulk of what you described is already shipped:

| Requirement | Status | Where |
|---|---|---|
| Music portals auto-generate a unique background wallpaper | Done | `generatePortalWallpaper` in `src/lib/portals.functions.ts` (Nano Banana 2, on portal create) |
| Same template structure for every music portal | Done | `src/routes/m.$slug.tsx` — single themed template, wallpaper layered behind |
| Format raw description into Suno-ready lyrics (with `[Verse]` / `[Chorus]` tags) | Done | `streamFormatLyrics` in `src/lib/music-portals.functions.ts` (Gemini 3 Flash, streams tokens) |
| Suno generates **2 versions** | Done | `generatePortalTrack` → webhook fills `audio_url_v1` and `audio_url_v2` |
| **30-second preview** before unlock | Done | `PreviewPlayer` clamps to 30 s while `download_unlocked = false` |
| Unlock full song with **2 coins** | Done | `unlockPortalTrackDownload` charges exactly 2 coins (matches your slider answer) |
| Boss-override (no payment) | Done last turn |

So this plan only covers the **net-new** behaviour: AI-assisted portal creation, a guided "OG-Bot asks" wizard, and per-generation swearing via Perplexity.

---

## 1. Boss: "Generate music portal from a description"

Today the boss types every field manually in `src/routes/boss.portals.tsx`. Add a one-shot AI helper for `kind = "music"` only.

- New server fn `generateMusicPortalDraft(description: string)` in `src/lib/music-portals.functions.ts`:
  - Calls Lovable AI Gateway with `google/gemini-3-flash-preview`, structured output (`response_format: json_object`).
  - Returns: `{ name, niche, style, vibe, theme, music_hooks[5], seo_title, seo_description, wallpaper_prompt }`.
  - Uses the existing portal style examples from `portals.functions.ts` as few-shot context so output stays on-brand.
- In `boss.portals.tsx` and `boss.hubs.new.tsx`, add an "AI draft from vibe" panel above the form (music kind only):
  - Textarea + "Generate draft" button → fills the form fields client-side, leaving the boss free to edit before save.
  - Wallpaper still auto-generates on save (no change needed there).

## 2. Fan-side OG-Bot conversational wizard

Replace the current single textarea on `m.$slug.tsx` ("Compose Your Vision") with a 3-step guided flow. Bot turns appear as styled chat bubbles, user inputs appear inline.

```text
OG-Bot:  "What's the song called?"
User:    [ song title input ]            -> "Next"

OG-Bot:  "Tell me what this song is about. Story, mood, lines you want in there."
User:    [ description textarea ]
         Swearing?  ( ) Clean  ( ) Heavy swears
                                            -> "Format my lyrics"

OG-Bot:  "Here's your draft —"             (streams Suno-ready lyrics)
         [ Use these / Edit / Regenerate ]
```

State machine: `idle → askingName → askingBrief → formatting → reviewing → ready-to-generate`. After "Use these", flow drops the user into the existing Suno style picker / Generate button untouched.

The title captured in step 1 is passed to `spawnMusic` as `title` so Suno labels the track correctly.

## 3. Swearing per generation (Gemini + Perplexity)

Currently swearing is portal-wide (`portal.swear_chat_enabled`). Your request is per-song, decided during the description phase.

- Extend `streamFormatLyrics` to accept an optional `swear: "clean" | "heavy"` override:
  - `clean` → always clean, even if portal has swear mode on (still blocked for religious portals).
  - `heavy` → Gemini writes the lyrics **clean first** (your instruction: "use gemini 3 then edited with swearing"), then a follow-up server step calls Perplexity (`sonar` model) with the clean draft and a swear-injection prompt that returns the same structure with brutal swears woven into lines (not stuffed at random).
  - Religious portals override `heavy` back to clean.
- New server fn `enhanceWithPerplexitySwears(lyrics: string)` in a new `src/lib/lyrics-enhance.server.ts`. Uses `PERPLEXITY_API_KEY` (already in secrets). Returns `{ lyrics }`.
- The UI streams Gemini tokens as normal, then shows "Adding heat…" while Perplexity rewrites, then swaps in the swearing version. Both versions stay in component state so the user can flip between clean and swearing before generating.

## 4. Small UX & copy tweaks

- Cost breakdown card on `m.$slug.tsx` already says "1 coin Generate / Free 30-sec preview / 2 coins Unlock". Keeps as-is.
- Add a clear "Boss can also enable swearing per-portal" hint in the wizard footer so non-religious portals don't confuse boss-level toggle with the per-song toggle.

---

## Technical details (for me, not the user)

- **No DB migration required.** Existing columns cover everything: `tracks.title` already nullable, `portals.swear_chat_enabled` already controls portal-wide default, `suno_jobs` already has `audio_url_v1/v2` and `download_unlocked_at`.
- All AI calls stay server-side: Gemini via Lovable AI Gateway, Perplexity via `process.env.PERPLEXITY_API_KEY`. No new secrets.
- Lovable AI Gateway model: `google/gemini-3-flash-preview` (matches your "use gemini 3" instruction).
- Perplexity model: `sonar` (cheapest, fast — we don't need grounding for swear injection).
- All new server fns use `requireStrictAuth` middleware. The portal-draft generator additionally checks `is_boss` so only boss can call it.
- Religious portal detection reuses the existing `isReligiousPortal()` helper so devotional MusicHubs are never poisoned with swears regardless of toggle.
- Wizard component lives in `src/components/OgBotComposer.tsx` so `m.$slug.tsx` stays readable.

## Files touched

- `src/lib/music-portals.functions.ts` — extend `streamFormatLyrics(swear?)`, add `generateMusicPortalDraft`
- `src/lib/lyrics-enhance.server.ts` (new) — Perplexity swear-injection helper
- `src/components/OgBotComposer.tsx` (new) — 3-step wizard
- `src/components/BossPortalAiDraft.tsx` (new) — boss "generate from description" panel
- `src/routes/m.$slug.tsx` — swap textarea for `<OgBotComposer />`
- `src/routes/boss.portals.tsx` — mount `<BossPortalAiDraft />` on music kind
- `src/routes/boss.hubs.new.tsx` — same panel for the new-hub flow

## Out of scope (ask if you want any of these)

- Voice cloning / custom singer per portal
- Saving multiple lyric drafts per song
- Auto-publishing the generated song to the portal catalog (currently the boss promotes a `suno_job` to a `tracks` row separately)
