## Plan: 0G-PORTAL Full Enterprise Automation

This is a large, multi-system build. I'll ship it in 4 cohesive workstreams. Confirm and I'll execute end-to-end.

---

### 1. Intelligence Core — Automated Scout (Admin Panel)

A new admin tool that takes a keyword and runs a full content pipeline:

1. **Perplexity** (`sonar-pro`) → search trending news on the keyword, return summary + citations.
2. **Firecrawl** → scrape the top 2-3 cited URLs for richer context (titles, themes).
3. **Lovable AI** (`google/gemini-2.5-flash`) → generate from the combined context:
   - 5 "Live Wire" jokes → inserted into a new `jokes` table (visible in JokesHUB).
   - 1 new calculator config (name, description, formula stub, inputs) → inserted into a new `calculators` table (rendered in ToolHUB).
4. UI: keyword input, "Run Scout" button, real-time progress log, preview of generated content with "Publish" / "Discard" actions.

**Tech:** new server fn `runAutomatedScout` in `src/lib/scout.functions.ts`, admin-only via `has_role`.

---

### 2. Vault Economy — Credit Gating + Syndicate Store

- **Syndicate Store route** (`/store`): polished shadcn dashboard listing the 3 existing Stripe packs + clear "0G Credits" balance with glowing blue progress bar.
- **Credit gating** via shared hook `useCreditGate(cost)`:
  - Wraps Live Wire generation (1 credit) and any tool flagged `vip: true` (1 credit).
  - On submit: server fn `spendCredits({ amount, reason })` atomically decrements `profiles.credits` (RPC `spend_credits` with row-level lock).
  - If balance = 0 → redirect to `/store?reason=empty` with a toast.
- New `credit_ledger` table for audit trail (user_id, delta, reason, created_at).

---

### 3. MusicHUB Automation

- **Lyric Assistant**: textarea for "vibe" → Lovable AI (`gpt-5-mini`) returns OG-style lyrics. Costs 2 credits per generation.
- **Request Custom Suno Track**: button that costs 50 credits, opens a form (style, mood, notes), inserts a row into new `custom_track_requests` table (status: pending). Admin sees requests in admin panel with "Mark Delivered" + URL field.
- Both gated by `useCreditGate`.

---

### 4. Global UI Overhaul — "Living Machine"

- **CSS additions in `src/styles.css`**:
  - `--shadow-electric`, `--gradient-flame` tokens.
  - Keyframes: `scanline` (vertical sweep), `electric-pulse` (border glow), `tv-static` (logo overlay flicker).
  - Utility classes: `.scan-overlay`, `.electric-border`, `.tv-static`.
- **Logo**: wrap Demon/TV logo with animated static SVG noise overlay (subtle, ~15% opacity).
- **Cards/Borders**: apply `electric-border` to dashboard cards, store packs, profile credit panel.
- **Page transitions**: thin scanline sweep on route mount.
- All animations honor `prefers-reduced-motion`.

---

### Database changes (single migration)

```sql
-- jokes (Live Wire output)
create table jokes (id uuid pk, content text, source text, created_by uuid, published bool, created_at);
-- calculators (ToolHUB output)
create table calculators (id uuid pk, slug text unique, name text, description text, config jsonb, vip bool, published bool, created_at);
-- credit ledger
create table credit_ledger (id uuid pk, user_id uuid, delta int, reason text, created_at);
-- custom track requests
create table custom_track_requests (id uuid pk, user_id uuid, vibe text, notes text, status text, deliverable_url text, created_at, updated_at);
-- RPC: spend_credits(amount int, reason text) returns int (new balance) or raises
```

RLS:
- Members see their own ledger + requests; admins see all.
- Jokes & calculators readable by everyone when `published = true`; only admins write.

---

### Files to create / edit (high level)

**New:**
- `src/lib/scout.functions.ts`, `src/lib/credits.functions.ts`, `src/lib/lyrics.functions.ts`, `src/lib/track-requests.functions.ts`
- `src/hooks/useCreditGate.ts`
- `src/routes/store.tsx`
- `src/components/ScoutPanel.tsx`, `src/components/LyricAssistant.tsx`, `src/components/CustomTrackForm.tsx`, `src/components/TVStaticLogo.tsx`, `src/components/CreditBalance.tsx`
- 1 migration file

**Edit:**
- `src/routes/admin.tsx` (Scout panel + custom track admin queue)
- `src/routes/jokes.tsx` / `jokes.portal.tsx` (gate Live Wire, render generated jokes)
- `src/routes/tools.tsx` (render dynamic calculators, gate VIP)
- `src/routes/music.tsx` (Lyric Assistant + Custom Track button)
- `src/routes/profile.tsx` (link to /store, electric borders)
- `src/styles.css` (animations + tokens)
- `src/routes/__root.tsx` (global scanline + logo overlay)

---

**Reply "go" and I'll execute the full build in one pass: migration → server fns → UI → animation polish.**
