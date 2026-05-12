
-- Tighten EXECUTE grants on SECURITY DEFINER functions.
-- Strategy:
--   1. Trigger / internal helper functions: revoke from PUBLIC, anon, authenticated.
--      They are invoked by triggers or by other SECURITY DEFINER functions
--      whose current_user becomes the owner, so internal calls keep working.
--   2. Boss-only RPCs that leaked anon/PUBLIC EXECUTE: revoke those, keep
--      authenticated (internal is_boss/has_role checks already gate them).
--   3. Intentional anon RPCs (vote counts, nav portals, analytics token,
--      domain denylist) are left untouched.

-- ============= Trigger / internal helpers (lock fully) =============
DO $$
DECLARE
  sig text;
  fns text[] := ARRAY[
    'public._emit_security_alert(text, text, uuid, uuid, text, text, jsonb)',
    'public._trg_profiles_security_audit()',
    'public._trg_user_roles_audit()',
    'public.assign_referral_code_on_vip()',
    'public.guard_profile_self_update()',
    'public.handle_new_user()',
    'public.magic_link_audit_rate_limit()',
    'public.prevent_profile_privilege_escalation()',
    'public.reject_denylisted_domains()',
    'public.tg_portal_brief_versioning()',
    'public.tg_stream_request_notify()',
    'public.touch_boss_function_ideas()',
    'public.touch_updated_at()'
  ];
BEGIN
  FOREACH sig IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', sig);
  END LOOP;
END $$;

-- ============= Boss-only RPCs that had stray anon/PUBLIC grants =============
REVOKE ALL ON FUNCTION public.boss_set_portal_published(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.boss_list_vip_pass_pool() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.boss_upsert_vip_pass_pool(uuid, text, text, boolean, integer, text, text) FROM PUBLIC, anon;

-- Re-grant authenticated EXECUTE explicitly so the internal Boss check stays the gate.
GRANT EXECUTE ON FUNCTION public.boss_set_portal_published(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.boss_list_vip_pass_pool() TO authenticated;
GRANT EXECUTE ON FUNCTION public.boss_upsert_vip_pass_pool(uuid, text, text, boolean, integer, text, text) TO authenticated;
