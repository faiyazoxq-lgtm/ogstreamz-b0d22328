-- 1) published flag on portals
ALTER TABLE public.portals
  ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS portals_published_idx ON public.portals (published) WHERE published = true;

-- 2) update list_nav_portals to filter unpublished for non-boss
CREATE OR REPLACE FUNCTION public.list_nav_portals()
 RETURNS TABLE(id uuid, slug text, name text, vip boolean, by_boss boolean, paid boolean, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.id, p.slug, p.name, p.vip,
    (p.created_by IS NULL
      OR public.is_boss(p.created_by)
      OR public.has_role(p.created_by, 'admin'::public.app_role)) AS by_boss,
    (COALESCE(p.price_cents,0) > 0 OR COALESCE(p.use_credit_cost,0) > 0) AS paid,
    p.created_at
  FROM public.portals p
  WHERE
    -- Boss / admin sees everything; everyone else only sees published
    (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR p.published = true)
    AND (
      (p.created_by IS NULL
        OR public.is_boss(p.created_by)
        OR public.has_role(p.created_by, 'admin'::public.app_role))
      OR (p.created_by IS NOT NULL
          AND (COALESCE(p.price_cents,0) > 0 OR COALESCE(p.use_credit_cost,0) > 0))
    )
  ORDER BY p.created_at DESC
  LIMIT 100;
$function$;

-- 3) boss publish toggle
CREATE OR REPLACE FUNCTION public.boss_set_portal_published(_portal_id uuid, _published boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Boss only';
  END IF;
  UPDATE public.portals
    SET published = COALESCE(_published, true), updated_at = now()
    WHERE id = _portal_id;
  RETURN FOUND;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.boss_set_portal_published(uuid, boolean) TO authenticated;
