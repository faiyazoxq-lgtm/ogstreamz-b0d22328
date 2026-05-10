-- Stream verification queue
CREATE TABLE IF NOT EXISTS public.stream_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text NOT NULL,
  password text NOT NULL,
  server text NOT NULL,
  auto_status text,
  auto_expires_at timestamptz,
  auto_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  decision_note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_svr_status_created ON public.stream_verification_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_svr_user ON public.stream_verification_requests (user_id);

ALTER TABLE public.stream_verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own stream requests" ON public.stream_verification_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_boss(auth.uid()) OR public.has_role(auth.uid(),'admin'::public.app_role));

CREATE POLICY "Boss manage stream requests" ON public.stream_verification_requests
  FOR ALL TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.is_boss(auth.uid()) OR public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TRIGGER svr_touch BEFORE UPDATE ON public.stream_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Enqueue (called by server fn via service role; auth check via _user_id)
CREATE OR REPLACE FUNCTION public.enqueue_stream_verification(
  _user_id uuid, _username text, _password text, _server text,
  _auto_status text, _auto_expires_at timestamptz, _auto_payload jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;
  IF auth.uid() <> _user_id AND NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(),'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  -- Cancel any prior pending requests for this user
  UPDATE public.stream_verification_requests
    SET status='superseded', updated_at=now()
    WHERE user_id=_user_id AND status='pending';
  INSERT INTO public.stream_verification_requests
    (user_id, username, password, server, auto_status, auto_expires_at, auto_payload)
    VALUES (_user_id, _username, _password, _server, _auto_status, _auto_expires_at, COALESCE(_auto_payload,'{}'::jsonb))
    RETURNING id INTO new_id;
  RETURN new_id;
END $$;

-- Boss decision: approve promotes to stream_user; reject leaves rank as-is
CREATE OR REPLACE FUNCTION public.boss_decide_stream_request(_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.stream_verification_requests;
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(),'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Boss only';
  END IF;
  SELECT * INTO r FROM public.stream_verification_requests WHERE id = _id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Already decided (%)', r.status; END IF;

  IF _approve THEN
    -- Save credentials onto profile
    UPDATE public.profiles
      SET stream_username = r.username,
          stream_password = r.password,
          stream_server = r.server,
          stream_status = COALESCE(r.auto_status, 'Active'),
          stream_verified_at = now(),
          stream_expires_at = r.auto_expires_at,
          rank = CASE
            WHEN rank IN ('prospect','enforcer') THEN 'stream_user'::public.syndicate_rank
            ELSE rank
          END,
          updated_at = now()
      WHERE id = r.user_id;

    UPDATE public.stream_verification_requests
      SET status='approved', decision_note=COALESCE(left(_note,500),''),
          decided_by=auth.uid(), decided_at=now()
      WHERE id = _id;
    RETURN jsonb_build_object('status','approved','user_id',r.user_id);
  ELSE
    UPDATE public.stream_verification_requests
      SET status='rejected', decision_note=COALESCE(left(_note,500),''),
          decided_by=auth.uid(), decided_at=now()
      WHERE id = _id;
    RETURN jsonb_build_object('status','rejected','user_id',r.user_id);
  END IF;
END $$;