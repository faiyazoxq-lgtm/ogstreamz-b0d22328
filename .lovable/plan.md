## Goal

Give the Boss a single, persistent to-do list inside the portal that holds every "make this project perfect" job, with priority + status, and start working through it **one item at a time** in agreed order.

---

## Part 1 — Build the Boss To-Do feature

A new page at `/boss/todo` plus a tile on the boss overview.

**Database** (`boss_todos` table)
- `title`, `details` (markdown), `category` (security · performance · ux · seo · ops · content), `priority` (P0–P3), `status` (todo · in_progress · blocked · done), `link` (optional deep-link into the boss portal), `position` (for drag ordering), `done_at`
- RLS: only the Boss role can read/write (reuse existing `has_role(auth.uid(),'boss')`)
- Realtime enabled so multiple tabs stay in sync

**Page** (`src/routes/boss.todo.tsx`)
- Grouped columns: **In progress · Todo · Blocked · Done**
- Filter chips by category and priority
- Inline add (title + priority + category)
- Click row → side drawer with details, link button, status switcher, "mark done"
- Counter pill on the boss overview tile showing open P0/P1 count

**Overview tile**
- Add `Boss To-Do` tile to `boss.overview.tsx` (system category, `ListChecks` icon, `#ffd166` tint), routes to `/boss/todo`

**Migration also seeds the prefilled jobs from Part 2** so the list is populated on first open.

---

## Part 2 — The prioritized job list (what gets seeded)

These are the jobs to make the project perfect. Ordered top-to-bottom = work order.

**P0 — must do next**
1. Wire the Cloudflare Web Analytics token (the placeholder from `/boss/analytics-setup`)
2. Run **Denylist Audit** and clean any DB hits it surfaces
3. Sweep `<a href>`, `<iframe src>`, `<img src>` usages in the codebase and swap to `SafeLink` / `SafeEmbed` / `SafeImage` for any field that holds external/member-supplied URLs
4. Add Cloudflare DNS + caching rules (the steps from the earlier Cloudflare guide)

**P1 — strong wins**
5. Lighthouse pass on `/`, `/music`, `/jokes`, `/tools`, `/vip` — fix LCP image (preload + `fetchpriority="high"`), defer non-critical JS, add `loading="lazy"` to below-fold images
6. SEO: per-route `head()` with unique title/description/og:image on every public route; verify single H1 and canonical tags
7. Accessibility: keyboard focus rings on all interactive elements, `aria-label` on icon-only buttons, color-contrast pass on tinted tiles
8. Error boundaries: confirm every route with a loader has `errorComponent` + `notFoundComponent`
9. Email verification flow review (signup → confirm → first login) end-to-end

**P2 — polish**
10. Add a publish checklist runner (extends existing `boss.publish-check`) that pings: analytics beacon present, denylist empty hits, sitemap reachable, robots.txt sane, all `/api/public/*` endpoints respond
11. Realtime presence indicator in the boss portal (who else is editing)
12. Backup export: nightly snapshot of key tables to storage bucket
13. Cost dashboard: surface AI Gateway spend per model in `boss.portal-costs`

**P3 — nice-to-haves**
14. Dark/light auto-switch with system preference
15. Custom 404 illustration
16. Boss audit log (who changed what, when)

---

## Part 3 — Working order

We tackle them **one at a time**, top-down. After each item ships:
- mark it done in `/boss/todo`
- I post the diff summary and what to verify
- you approve → I pick up the next one

First up after this plan: **Part 1 itself** (build the to-do page + seed the jobs). Then I'll start on P0 #1 (Cloudflare Analytics token wiring).

---

## Technical notes

- New file: `src/routes/boss.todo.tsx`
- New migration: `boss_todos` table + RLS + seed inserts for the 16 jobs above
- Edit: `src/routes/boss.overview.tsx` — add the tile
- No new dependencies; uses existing shadcn `Card`, `Badge`, `Sheet`, `Select`
- Realtime via existing supabase channel pattern from `use-domain-denylist.ts`