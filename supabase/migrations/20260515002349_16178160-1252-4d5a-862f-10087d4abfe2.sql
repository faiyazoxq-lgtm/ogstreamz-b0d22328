-- 1. Canonical OG tier enum
DO $$ BEGIN
  CREATE TYPE public.og_tier AS ENUM ('free','stream_user','vip','real_og','boss');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Add column on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS og_tier public.og_tier NOT NULL DEFAULT 'free';

-- 3. Derivation helper
CREATE OR REPLACE FUNCTION public.derive_og_tier(_user_id uuid)
RETURNS public.og_tier
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p_rank public.syndicate_rank;
  p_status public.account_status;
  p_plan public.subscription_plan;
  has_stream boolean;
  has_vip boolean;
  is_boss_user boolean;
BEGIN
  SELECT rank, status, subscription_plan
    INTO p_rank, p_status, p_plan
  FROM public.profiles WHERE id = _user_id;

  is_boss_user := (p_rank = 'boss'::public.syndicate_rank)
                  OR public.has_role(_user_id, 'admin'::public.app_role);
  IF is_boss_user THEN RETURN 'boss'::public.og_tier; END IF;

  has_stream := EXISTS (
    SELECT 1 FROM public.stream_account_links l
     WHERE l.user_id = _user_id
       AND COALESCE(l.status,'') ILIKE 'active'
       AND (l.expires_at IS NULL OR l.expires_at > now())
  );

  has_vip := (p_status = 'vip'::public.account_status)
             OR (p_rank = 'vip'::public.syndicate_rank)
             OR (p_plan IN ('energy'::public.subscription_plan,'syndicate'::public.subscription_plan))
             OR EXISTS (
               SELECT 1 FROM public.vip_passes v
                WHERE v.user_id = _user_id
                  AND v.revoked_at IS NULL
                  AND v.expires_at > now()
             );

  IF has_vip AND has_stream THEN RETURN 'real_og'::public.og_tier; END IF;
  IF has_vip THEN RETURN 'vip'::public.og_tier; END IF;
  IF has_stream THEN RETURN 'stream_user'::public.og_tier; END IF;
  RETURN 'free'::public.og_tier;
END $$;

-- 4. Backfill
UPDATE public.profiles p
   SET og_tier = public.derive_og_tier(p.id);

-- 5. Triggers to keep og_tier in sync
CREATE OR REPLACE FUNCTION public.sync_og_tier_for_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
     SET og_tier = public.derive_og_tier(_user_id),
         updated_at = now()
   WHERE id = _user_id
     AND og_tier IS DISTINCT FROM public.derive_og_tier(_user_id);
END $$;

CREATE OR REPLACE FUNCTION public.tg_profiles_sync_og_tier()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE new_tier public.og_tier;
BEGIN
  -- Only recompute on fields that affect derivation
  IF TG_OP = 'UPDATE' AND
     NEW.rank IS NOT DISTINCT FROM OLD.rank AND
     NEW.status IS NOT DISTINCT FROM OLD.status AND
     NEW.subscription_plan IS NOT DISTINCT FROM OLD.subscription_plan THEN
    RETURN NEW;
  END IF;
  new_tier := public.derive_og_tier(NEW.id);
  IF NEW.og_tier IS DISTINCT FROM new_tier THEN
    NEW.og_tier := new_tier;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_sync_og_tier ON public.profiles;
CREATE TRIGGER profiles_sync_og_tier
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_sync_og_tier();

CREATE OR REPLACE FUNCTION public.tg_stream_links_sync_og_tier()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_og_tier_for_user(OLD.user_id);
    RETURN OLD;
  ELSE
    PERFORM public.sync_og_tier_for_user(NEW.user_id);
    RETURN NEW;
  END IF;
END $$;

DROP TRIGGER IF EXISTS stream_links_sync_og_tier ON public.stream_account_links;
CREATE TRIGGER stream_links_sync_og_tier
AFTER INSERT OR UPDATE OR DELETE ON public.stream_account_links
FOR EACH ROW EXECUTE FUNCTION public.tg_stream_links_sync_og_tier();

-- 6. Boss-only setter that respects derivation rules
CREATE OR REPLACE FUNCTION public.boss_set_og_tier(_user_id uuid, _tier public.og_tier)
RETURNS public.og_tier
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(),'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Boss only';
  END IF;

  IF _tier = 'boss'::public.og_tier THEN
    UPDATE public.profiles
       SET rank = 'boss'::public.syndicate_rank,
           status = 'vip'::public.account_status,
           updated_at = now()
     WHERE id = _user_id;
  ELSIF _tier IN ('vip'::public.og_tier,'real_og'::public.og_tier) THEN
    UPDATE public.profiles
       SET status = 'vip'::public.account_status,
           rank = CASE WHEN rank = 'boss'::public.syndicate_rank THEN rank ELSE 'vip'::public.syndicate_rank END,
           updated_at = now()
     WHERE id = _user_id;
  ELSIF _tier = 'stream_user'::public.og_tier THEN
    UPDATE public.profiles
       SET status = CASE WHEN status = 'vip' THEN 'free'::public.account_status ELSE status END,
           rank = CASE WHEN rank IN ('boss'::public.syndicate_rank) THEN rank
                       ELSE 'stream_user'::public.syndicate_rank END,
           updated_at = now()
     WHERE id = _user_id;
  ELSE -- free
    UPDATE public.profiles
       SET status = 'free'::public.account_status,
           rank = 'enforcer'::public.syndicate_rank,
           updated_at = now()
     WHERE id = _user_id;
  END IF;

  -- Trigger will recompute and set og_tier; force-sync in case of edge cases.
  PERFORM public.sync_og_tier_for_user(_user_id);
  RETURN (SELECT og_tier FROM public.profiles WHERE id = _user_id);
END $$;

-- 7. Migrate syndicate_bots.tier_required values
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='syndicate_bots' AND column_name='tier_required'
  ) THEN
    -- Cast to text, remap, leave as text (avoids enum coupling)
    ALTER TABLE public.syndicate_bots
      ALTER COLUMN tier_required TYPE text USING tier_required::text;

    UPDATE public.syndicate_bots
       SET tier_required = CASE lower(tier_required)
         WHEN 'metal' THEN 'stream_user'
         WHEN 'energy' THEN 'vip'
         WHEN 'syndicate' THEN 'real_og'
         WHEN 'free' THEN 'free'
         ELSE tier_required
       END;
  END IF;
END $$;