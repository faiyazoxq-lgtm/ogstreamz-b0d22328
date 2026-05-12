
REVOKE ALL ON public.pending_credit_grants FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.portal_brief_versions FROM anon, authenticated, PUBLIC;

CREATE OR REPLACE FUNCTION public.get_my_portal_brief_versions(_portal_id uuid)
RETURNS TABLE (
  id uuid,
  version integer,
  brief jsonb,
  halalify jsonb,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id, v.version, v.brief, v.halalify, v.created_at
  FROM public.portal_brief_versions v
  JOIN public.portals p ON p.id = v.portal_id
  WHERE v.portal_id = _portal_id
    AND auth.uid() IS NOT NULL
    AND (
      p.created_by = auth.uid()
      OR public.is_boss(auth.uid())
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  ORDER BY v.version DESC, v.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_my_portal_brief_versions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_portal_brief_versions(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_pending_credit_grant_summary()
RETURNS TABLE (
  has_pending boolean,
  pending_count integer,
  total_credits integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  user_email text;
BEGIN
  IF uid IS NULL THEN
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;
  SELECT email INTO user_email FROM public.profiles WHERE id = uid;
  IF user_email IS NULL OR length(trim(user_email)) = 0 THEN
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;
  RETURN QUERY
    SELECT
      (COUNT(*) > 0)::boolean,
      COALESCE(COUNT(*), 0)::integer,
      COALESCE(SUM(credits), 0)::integer
    FROM public.pending_credit_grants
    WHERE claimed_at IS NULL
      AND lower(email) = lower(user_email);
END;
$$;
REVOKE ALL ON FUNCTION public.my_pending_credit_grant_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_pending_credit_grant_summary() TO authenticated;

REVOKE ALL ON public.tracks_public FROM PUBLIC;
GRANT SELECT ON public.tracks_public TO anon, authenticated;

COMMENT ON VIEW public.tracks_public IS
  'Sanitised projection of public.tracks for client reads. Excludes full_path '
  'and suno_prompt so paid/unowned media URIs and prompt IP never leak. '
  'Direct SELECT on public.tracks remains admin-only.';
