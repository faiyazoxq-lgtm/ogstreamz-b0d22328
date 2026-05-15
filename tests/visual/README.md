# Navbar visual regression

Pixel-diff snapshots of the live site chrome to catch logo overflow,
vertical clipping, and sticky-header layout shift across phone widths
(320, 360, 375, 390, 414, 420) and desktop widths (1280, 1440).

## What is covered

- **Mobile header** — `<header className="md:hidden ...">` in
  `src/components/AppShell.tsx`. Snapshotted at every mobile width in
  both unscrolled and scrolled-600px states.
- **Desktop sidebar brand** — the `<a aria-label="Home">` inside
  `<aside className="hidden md:flex ...">` in the same file.
- **Layout-shift assertion** — a non-screenshot test that fails if the
  mobile header changes height between top and scrolled.
- **Overflow assertion** — checks the brand link sits fully inside the
  header row at every mobile width.

An older `src/components/NavBar.tsx` used to live in the tree but was
never imported anywhere. It has been deleted — `AppShell.tsx` is the
single source of truth for the site header/sidebar. If a new top-level
navbar component is introduced later, add its spec here.

## Running locally

```bash
# One-time: install browsers
npx playwright install chromium

# Run the suite (will start `bun run dev` automatically)
bun run test:visual

# Intentionally regenerate baselines after a known UI change
bun run test:visual:update
```

## Running against an already-running server

```bash
PLAYWRIGHT_BASE_URL=http://localhost:5173 bun run test:visual
```

## CI

`.github/workflows/visual-regression.yml` runs the suite on every PR.
On failure, the diff PNGs and HTML report are uploaded as artifacts so
you can see exactly which pixels changed.

## Updating baselines

Baselines live under `tests/visual/__screenshots__/`. Regenerate them
with `bun run test:visual:update` and commit the new PNGs in the same
PR as the UI change that justifies them. Never blindly accept a diff —
inspect the report first.