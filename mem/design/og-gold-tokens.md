---
name: OG gold halo tokens
description: Shared CSS variables for the OG PORTAL electric-gold and metallic halo palette
type: design
---
Defined in `src/styles.css` `:root`. Tokens: `--og-gold-bright`, `--og-gold`, `--og-gold-warm`, `--og-gold-deep`, `--og-gold-shadow`, `--og-metal-ink`. Use `color-mix(in oklab, var(--og-gold-warm) 65%, transparent)` for opacity. Consumed by `OgWordmark` filter and `.og-portal-shimmer` keyframes. Never hardcode oklch gold values for new accents.
