## Goal

A single reusable layout that every portal page renders. Built once, plug in per portal with `portalKey`, name, fixed style sentence, and a generator function. New portals get the look for free.

## Layout (top to bottom)

```text
+------------------------------------------+
| [ AI-generated background image ]        |
|                                          |
|        LARGE PORTAL NAME                 |
|        ai-generated short description    |
|                                          |
+------------------------------------------+
| [ multi-line prompt textarea         ]   |
| Style: <fixed style sentence>            |
| [ Generate ]                             |
+------------------------------------------+
| Latest creation (inline result)          |
+------------------------------------------+
| Your library (saved items, scrollable)   |
+------------------------------------------+
```

Style sentence is shown to the user verbatim and auto-prepended to their prompt before sending to the generator. Same prepended prompt is what gets stored.

## Backend

New table `portal_headers`:
- `portal_key` (text, primary key) — e.g. `music`, `jokes`, `tools`, `battles`, `syndicate`
- `title` (text)
- `description` (text)
- `bg_url` (text)

Public read, service-role write (RLS).

New table `portal_creations`:
- `user_id`, `portal_key`, `prompt` (with style prefix already merged), `output` (jsonb — text, image url, audio url, etc.), `created_at`

RLS: user reads/writes only their own rows. Realtime not needed.

New storage bucket `portal-bg` (public). Headers are generated once per portal — no re-roll.

Server fns in `src/lib/portal-shell.functions.ts`:
- `getPortalHeader(portalKey)` — returns cached row, or generates via Lovable AI (text) + Nano Banana (image), uploads to `portal-bg`, inserts into `portal_headers`, returns. Service role.
- `recordPortalCreation({ portalKey, prompt, output })` — auth-required insert into `portal_creations`.
- `listPortalCreations({ portalKey, limit })` — auth-required, returns the user's own rows.

## Frontend

New `src/components/PortalShell.tsx`:

```tsx
<PortalShell
  portalKey="music"
  name="MusicHUB"
  styleSentence="Cinematic neon street-rap, gritty bass, OG energy."
  placeholder="Describe the track you want…"
  onGenerate={async (mergedPrompt) => {
    const result = await generateTrack({ data: { prompt: mergedPrompt } });
    return { node: <TrackPlayer track={result} />, saved: { kind: "track", url: result.url, title: result.title } };
  }}
  renderSaved={(c) => <SavedTrackRow creation={c} />}
/>
```

Shell handles: header fetch + skeleton, textarea, style line, generate button (with loading + error toasts), inline result slot, saved-creations list (live re-fetch on success).

## Wire-up (this turn)

Replace top of each existing portal page with `<PortalShell>`. Existing generators keep working — the shell just calls them with the merged prompt. Touched pages this turn:

1. `src/routes/music.tsx`
2. `src/routes/jokes.tsx`
3. `src/routes/tools.tsx`

Other portal pages (`battle.tsx`, `battlehub.tsx`, `jokes.portal.tsx`, `syndicate.tsx`, `syndicate-overlord.tsx`) keep their current UIs this turn — `<PortalShell>` is ready to drop in next time we touch them, so the pattern holds for "current and future" without rewriting 6,000+ lines in one go.

## Style sentences (fixed per portal)

- music: "Cinematic neon street-rap with gritty bass and OG energy."
- jokes: "Razor-sharp punch-up roast, club-room timing, no slurs."
- tools: "Concise, decisive, OG-tone explanation with one actionable next step."

Editable later from `boss.portals.tsx` (out of scope this turn).

## Out of scope

- Re-rolling cached headers (you said "generate once, cache forever"; admin can clear via DB if needed).
- Editable style sentences (fixed per portal as you chose).
- Migrating non-music/jokes/tools portals (shell ready, swap-in later).
- Changing the existing generator server functions or their output formats.
