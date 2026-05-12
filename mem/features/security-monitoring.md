---
name: Security monitoring
description: How sign-ins, role/rank changes, and bans are audited and surfaced to Boss
type: feature
---
- All auth events are logged via `logSecurityEvent` (auth-required, supabaseAdmin) into `public.security_events`. Per-tab dedupe on `sign_in` via `sessionStorage["sec:signin-logged"]`.
- New-device detection: browser stores a random id in `localStorage["ogs:device-id"]`, hashed with SHA-256 before being sent. Hash compared/stored in `public.known_devices`.
- Triggers (`_trg_user_roles_audit`, `_trg_profiles_security_audit`) auto-insert a `security_events` row AND a `system_alerts` row with category `security` whenever:
  - `user_roles` row added/removed
  - `profiles.rank` changes
  - `profiles.banned` flips
- Sign-ins flagged (severity=warn) when device is new OR hour ∈ [02:00,05:00) UTC. Both also raise a Boss `system_alerts` entry.
- Boss feed: `/boss/security-events` (filter by event substring + window). Existing `/boss/alerts` already shows the `security` category alerts.
- Adding new auth-relevant events: extend `KNOWN_EVENTS` enum in `src/lib/security-monitor.functions.ts`, never bypass `logSecurityEvent` (it's the only way to attach IP/UA correctly).