-- Column-privilege lockdown for sensitive `tracks` columns.
-- RLS row policies cannot restrict individual columns — only table/column GRANTs can.
-- Strategy: revoke blanket SELECT, then re-grant SELECT on the safe columns only.

REVOKE SELECT ON public.tracks FROM anon, authenticated;

GRANT SELECT (
  id,
  portal_slug,
  title,
  preview_path,
  price_cents,
  currency,
  created_by,
  created_at,
  updated_at
) ON public.tracks TO anon, authenticated;

-- service_role keeps full access (it always bypasses column GRANTs anyway,
-- but be explicit for clarity / future audits).
GRANT SELECT ON public.tracks TO service_role;