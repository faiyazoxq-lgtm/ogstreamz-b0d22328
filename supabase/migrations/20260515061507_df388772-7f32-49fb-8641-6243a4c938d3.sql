-- Lock down sensitive internal/webhook/cron/trigger functions in public schema.
-- Strategy: REVOKE EXECUTE from PUBLIC, anon, authenticated; ensure service_role keeps EXECUTE.
-- Admin (boss_*) functions called from the admin UI as the authenticated user are intentionally
-- left untouched — they self-enforce via is_boss(auth.uid()) inside SECURITY DEFINER bodies.

DO $$
DECLARE
  fn record;
  sigs text[] := ARRAY[
    -- Internal helpers (underscore-prefixed)
    'public._emit_security_alert(text, text, uuid, uuid, text, text, jsonb)',
    'public._lifetime_vip_expiry()',
    'public._profile_self_update_safe(uuid, syndicate_rank, account_status, integer, subscription_plan, boolean)',
    'public._profile_self_update_safe(uuid, syndicate_rank, account_status, integer, subscription_plan, boolean, uuid, jsonb)',
    'public._stream_link_secret()',
    'public._trg_profiles_security_audit()',
    'public._trg_user_roles_audit()',

    -- Webhook-only (called via service_role from /api/public/payments/webhook.ts and similar)
    'public.apply_credit_purchase(uuid, text, text, integer, integer, text, text)',
    'public.apply_pending_grants(uuid, text)',

    -- Cron / scheduled cleanup (called by pg_cron or admin server fns via service_role)
    'public.downgrade_expired_stream_users()',
    'public.purge_stream_verification_requests()',
    'public.purge_portal_view_events()',

    -- Notification helpers (only fired from triggers / server-side logic)
    'public.notify_user(uuid, text, text, text, jsonb)',
    'public.notify_stream_expiring_soon()',

    -- Stream verification helpers (server-side only paths)
    'public.mark_stream_verified(uuid)',
    'public.get_stream_creds_for(uuid)',

    -- Trigger functions (Postgres invokes these directly; no role needs EXECUTE)
    'public.assign_referral_code_on_vip()',
    'public.handle_new_user()',
    'public.guard_profile_self_update()',
    'public.prevent_profile_privilege_escalation()',
    'public.validate_profile_stream_links()',
    'public.reject_denylisted_domains()',
    'public.set_updated_at()',
    'public.touch_app_settings_updated_at()',
    'public.touch_boss_function_ideas()',
    'public.touch_updated_at()',
    'public.update_updated_at_column()',
    'public.tg_portal_brief_versioning()',
    'public.tg_profiles_sync_og_tier()',
    'public.tg_stream_links_sync_og_tier()',
    'public.tg_stream_request_notify()',

    -- Misc internal helpers (not called from .rpc() in the codebase)
    'public.magic_link_audit_rate_limit()',
    'public.normalize_denylist_domain(text)',
    'public.text_contains_denylisted_domain(text)',
    'public.sync_og_tier_for_user(uuid)'
  ];
  sig text;
BEGIN
  FOREACH sig IN ARRAY sigs LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', sig);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', sig);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', sig);
      RAISE NOTICE 'Locked down: %', sig;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'Skipped (not found): %', sig;
    END;
  END LOOP;
END
$$;