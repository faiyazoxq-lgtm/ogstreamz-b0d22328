-- Pending credit grants — pre-loaded by boss before user signs up
CREATE TABLE IF NOT EXISTS public.pending_credit_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  credits integer NOT NULL DEFAULT 0,
  grant_rank public.syndicate_rank,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  claimed_by uuid
);

CREATE INDEX IF NOT EXISTS pending_credit_grants_email_idx
  ON public.pending_credit_grants ((lower(email))) WHERE claimed_at IS NULL;

ALTER TABLE public.pending_credit_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Boss manages pending grants"
  ON public.pending_credit_grants
  FOR ALL TO authenticated
  USING (public.is_boss(auth.uid()))
  WITH CHECK (public.is_boss(auth.uid()));

-- Apply any pending grants for this user (by email). SECURITY DEFINER so it
-- can update profiles + write the ledger from a trigger context.
CREATE OR REPLACE FUNCTION public.apply_pending_grants(_user_id uuid, _email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g RECORD;
  total integer := 0;
BEGIN
  IF _email IS NULL OR length(trim(_email)) = 0 THEN RETURN 0; END IF;
  FOR g IN
    SELECT * FROM public.pending_credit_grants
    WHERE claimed_at IS NULL AND lower(email) = lower(_email)
    FOR UPDATE
  LOOP
    IF COALESCE(g.credits, 0) > 0 THEN
      UPDATE public.profiles
        SET credits = credits + g.credits,
            rank = COALESCE(g.grant_rank, rank),
            status = CASE WHEN g.grant_rank IN ('vip','boss') THEN 'vip'::account_status ELSE status END,
            updated_at = now()
        WHERE id = _user_id;
      INSERT INTO public.credit_ledger (user_id, delta, reason)
        VALUES (_user_id, g.credits, 'pre_grant:' || g.id);
      total := total + g.credits;
    ELSIF g.grant_rank IS NOT NULL THEN
      UPDATE public.profiles
        SET rank = g.grant_rank,
            status = CASE WHEN g.grant_rank IN ('vip','boss') THEN 'vip'::account_status ELSE status END,
            updated_at = now()
        WHERE id = _user_id;
    END IF;
    UPDATE public.pending_credit_grants
      SET claimed_at = now(), claimed_by = _user_id
      WHERE id = g.id;
  END LOOP;
  RETURN total;
END $$;

-- Update handle_new_user to also claim pending grants
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  PERFORM public.apply_pending_grants(NEW.id, NEW.email);

  RETURN NEW;
END $$;

-- Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Boss helper: queue OR immediately apply by email
CREATE OR REPLACE FUNCTION public.boss_grant_by_email(
  _email text, _credits integer, _grant_rank public.syndicate_rank, _notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  applied integer := 0;
  pid uuid;
BEGIN
  IF NOT public.is_boss(auth.uid()) THEN RAISE EXCEPTION 'Boss only'; END IF;
  IF _email IS NULL OR length(trim(_email)) = 0 THEN RAISE EXCEPTION 'Email required'; END IF;

  SELECT id INTO uid FROM public.profiles WHERE lower(email) = lower(trim(_email)) LIMIT 1;

  INSERT INTO public.pending_credit_grants (email, credits, grant_rank, notes, created_by)
    VALUES (lower(trim(_email)), GREATEST(0, COALESCE(_credits, 0)), _grant_rank, _notes, auth.uid())
    RETURNING id INTO pid;

  IF uid IS NOT NULL THEN
    applied := public.apply_pending_grants(uid, _email);
    RETURN jsonb_build_object('status','applied','user_id',uid,'credits',applied,'grant_id',pid);
  END IF;
  RETURN jsonb_build_object('status','queued','grant_id',pid);
END $$;