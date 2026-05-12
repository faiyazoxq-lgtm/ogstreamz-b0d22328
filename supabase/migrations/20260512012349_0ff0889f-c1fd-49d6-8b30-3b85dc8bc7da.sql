CREATE OR REPLACE FUNCTION public.guard_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  old_flags jsonb := COALESCE(OLD.feature_flags, '{}'::jsonb);
  new_flags jsonb := COALESCE(NEW.feature_flags, '{}'::jsonb);
  -- Strip user-controllable keys before comparing so users can flip their
  -- own Swearing Agent without tripping the privileged-fields guard.
  old_priv jsonb := old_flags - 'swearing' - 'swearing_intensity';
  new_priv jsonb := new_flags - 'swearing' - 'swearing_intensity';
BEGIN
  IF public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.rank IS DISTINCT FROM OLD.rank
     OR NEW.credits IS DISTINCT FROM OLD.credits
     OR NEW.subscription_plan IS DISTINCT FROM OLD.subscription_plan
     OR NEW.status IS DISTINCT FROM OLD.status
     OR new_priv IS DISTINCT FROM old_priv
     OR NEW.referred_by_reseller IS DISTINCT FROM OLD.referred_by_reseller
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile fields';
  END IF;
  RETURN NEW;
END;
$function$;