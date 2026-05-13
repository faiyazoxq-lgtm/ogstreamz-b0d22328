---
name: Hub titles shown as categories to non-boss users
description: Non-boss/non-VIP users see hub names inside portals labeled as category names, not as branded "HUB" titles
type: feature
---
For users who are NOT boss (and typically not VIP), hub titles displayed inside portals must be presented as plain category names rather than the branded HUB wordmarks.

- Boss (and VIP where applicable): see full branded titles (e.g. "MusicHUB", "JokesHUB", "ToolHUB", "TradeHUB").
- Everyone else: see the same surface labeled as the underlying category (e.g. "Music", "Jokes", "Tools", "Trade") — no "HUB" suffix, no branded styling.

Apply this anywhere a hub title is rendered inside a portal page (PortalHeader name prop, hub section headers, breadcrumbs, page <title>). Gate on `isBoss` from `useAuth()`; fall back to category label when false.
