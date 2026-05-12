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
    -- Boss / admin sees everything; everyone else only sees published, boss-created portals
    (
      public.is_boss(auth.uid())
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR (
        p.published = true
        AND (
          p.created_by IS NULL
          OR public.is_boss(p.created_by)
          OR public.has_role(p.created_by, 'admin'::public.app_role)
        )
      )
    )
  ORDER BY p.created_at DESC
  LIMIT 100;
$function$;