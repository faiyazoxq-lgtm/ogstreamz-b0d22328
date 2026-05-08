CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ref_id uuid;
BEGIN
  BEGIN
    ref_id := NULLIF(NEW.raw_user_meta_data->>'referred_by_reseller','')::uuid;
  EXCEPTION WHEN others THEN ref_id := NULL;
  END;

  INSERT INTO public.profiles (id, email, credits, status, rank, referred_by_reseller)
  VALUES (NEW.id, NEW.email, 5, 'free', 'prospect'::public.syndicate_rank, ref_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END $function$;