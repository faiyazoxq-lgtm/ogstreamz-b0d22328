CREATE TABLE public.topup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text,
  credits_requested integer NOT NULL DEFAULT 10,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  credits_granted integer,
  decision_note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.topup_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members create own topup request"
  ON public.topup_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members view own topup request"
  ON public.topup_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Boss reads all topup requests"
  ON public.topup_requests FOR SELECT TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Boss decides topup requests"
  ON public.topup_requests FOR UPDATE TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Boss deletes topup requests"
  ON public.topup_requests FOR DELETE TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_topup_requests_user ON public.topup_requests(user_id, created_at DESC);
CREATE INDEX idx_topup_requests_status ON public.topup_requests(status, created_at DESC);

CREATE TRIGGER touch_topup_requests
  BEFORE UPDATE ON public.topup_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Function: member submits a request (rate-limit: max 1 pending per user)
CREATE OR REPLACE FUNCTION public.request_topup(_credits integer, _reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  user_email text;
  open_count integer;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _credits IS NULL OR _credits < 1 OR _credits > 500 THEN
    RAISE EXCEPTION 'Credits must be between 1 and 500';
  END IF;
  SELECT count(*) INTO open_count FROM public.topup_requests
    WHERE user_id = uid AND status = 'pending';
  IF open_count > 0 THEN
    RAISE EXCEPTION 'You already have a pending top-up request';
  END IF;
  SELECT email INTO user_email FROM public.profiles WHERE id = uid;
  INSERT INTO public.topup_requests (user_id, email, credits_requested, reason)
    VALUES (uid, user_email, _credits, COALESCE(left(_reason, 500), ''))
    RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- Function: boss approves -> grants credits and marks approved
CREATE OR REPLACE FUNCTION public.boss_approve_topup(_id uuid, _credits integer, _note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.topup_requests;
  new_balance integer;
BEGIN
  IF NOT public.is_boss(auth.uid()) THEN RAISE EXCEPTION 'Boss only'; END IF;
  SELECT * INTO req FROM public.topup_requests WHERE id = _id FOR UPDATE;
  IF req.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'Already decided'; END IF;
  IF _credits IS NULL OR _credits < 1 OR _credits > 1000 THEN
    RAISE EXCEPTION 'Invalid credit amount';
  END IF;

  UPDATE public.profiles
    SET credits = credits + _credits, updated_at = now()
    WHERE id = req.user_id
    RETURNING credits INTO new_balance;

  INSERT INTO public.credit_ledger (user_id, delta, reason)
    VALUES (req.user_id, _credits, 'topup:approved:' || _id);

  UPDATE public.topup_requests
    SET status = 'approved',
        credits_granted = _credits,
        decision_note = COALESCE(left(_note, 500), ''),
        decided_by = auth.uid(),
        decided_at = now()
    WHERE id = _id;

  RETURN jsonb_build_object('balance', new_balance, 'credits', _credits);
END;
$$;

-- Function: boss denies a request
CREATE OR REPLACE FUNCTION public.boss_deny_topup(_id uuid, _note text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_boss(auth.uid()) THEN RAISE EXCEPTION 'Boss only'; END IF;
  UPDATE public.topup_requests
    SET status = 'denied',
        decision_note = COALESCE(left(_note, 500), ''),
        decided_by = auth.uid(),
        decided_at = now()
    WHERE id = _id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found or already decided'; END IF;
  RETURN true;
END;
$$;