-- 1. Revoke EXECUTE from anon/authenticated/PUBLIC on functions that are
--    trigger bodies or internal helpers. They are still callable by the
--    table triggers / SECURITY DEFINER callers that own them, but should not
--    be invokable directly via the PostgREST API surface. Each REVOKE here
--    eliminates one duplicate scanner finding and maps the rest 1:1 to a
--    real, intentionally-exposed function.

REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_referral_code_on_vip()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at()                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_boss_function_ideas()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_profile_self_update()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._stream_link_secret()                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._profile_self_update_safe(uuid, syndicate_rank, account_status, integer, subscription_plan, boolean)
  FROM PUBLIC, anon, authenticated;

-- 2. Seed function_exec_audit with one justified row per legitimately
--    public helper, so the Boss → Function Audit page shows a deduplicated
--    1:1 mapping between each remaining linter finding and a reviewed
--    function with an explanation.

INSERT INTO public.function_exec_audit (signature, justification, status, reviewed_at)
VALUES
  (
    'public.get_cf_analytics_token()',
    'Returns the public Cloudflare Web Analytics token. Token is intentionally embedded in the public client to enable analytics for unauthenticated visitors. No sensitive data is exposed.',
    'justified', now()
  ),
  (
    'public.get_domain_denylist()',
    'Returns the public domain denylist used by the in-page guard component to block disallowed embedded URLs. Must be readable by anonymous visitors before sign-in.',
    'justified', now()
  ),
  (
    'public.list_nav_portals()',
    'Returns the public navigation list of portals shown on the homepage. Read-only and only exposes safe public columns (slug, title, hero copy).',
    'justified', now()
  )
ON CONFLICT (signature) DO UPDATE SET
  justification = EXCLUDED.justification,
  status        = EXCLUDED.status,
  reviewed_at   = now();