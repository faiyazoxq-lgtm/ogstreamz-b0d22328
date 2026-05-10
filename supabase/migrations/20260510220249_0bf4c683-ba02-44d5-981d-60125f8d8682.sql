
-- Power controls: coin freeze flag + purchase reversal audit + RPC

INSERT INTO public.app_settings (key, value)
VALUES ('power.coin_frozen', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.purchase_reversals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL CHECK (source_table IN ('credit_purchases','track_purchases')),
  source_id uuid NOT NULL,
  user_id uuid NOT NULL,
  credits_reversed integer NOT NULL DEFAULT 0,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  reversed_by uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_table, source_id)
);

ALTER TABLE public.purchase_reversals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_reversals boss read"
ON public.purchase_reversals FOR SELECT TO authenticated
USING (is_boss(auth.uid()) OR has_role(auth.uid(),'admin'::app_role));

-- Reverse purchases in the past N minutes; refunds credits via credit_ledger.
CREATE OR REPLACE FUNCTION public.reverse_recent_purchases(window_minutes integer, dry_run boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  cutoff timestamptz := now() - make_interval(mins => GREATEST(window_minutes, 0));
  cp_count int := 0;
  tp_count int := 0;
  credits_total int := 0;
  amount_total int := 0;
  rec record;
BEGIN
  IF NOT (is_boss(caller) OR has_role(caller,'admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR rec IN
    SELECT id, user_id, credits_granted, amount_cents, currency
    FROM credit_purchases
    WHERE created_at >= cutoff
      AND NOT EXISTS (SELECT 1 FROM purchase_reversals r WHERE r.source_table='credit_purchases' AND r.source_id = credit_purchases.id)
  LOOP
    cp_count := cp_count + 1;
    credits_total := credits_total + rec.credits_granted;
    amount_total := amount_total + rec.amount_cents;
    IF NOT dry_run THEN
      INSERT INTO credit_ledger(user_id, delta, reason)
      VALUES (rec.user_id, -rec.credits_granted, 'reversal:credit_purchase:'||rec.id);
      INSERT INTO purchase_reversals(source_table, source_id, user_id, credits_reversed, amount_cents, currency, reversed_by, reason)
      VALUES ('credit_purchases', rec.id, rec.user_id, rec.credits_granted, rec.amount_cents, rec.currency, caller, 'boss_power_panel');
    END IF;
  END LOOP;

  FOR rec IN
    SELECT id, user_id, amount_cents, currency
    FROM track_purchases
    WHERE created_at >= cutoff
      AND NOT EXISTS (SELECT 1 FROM purchase_reversals r WHERE r.source_table='track_purchases' AND r.source_id = track_purchases.id)
  LOOP
    tp_count := tp_count + 1;
    amount_total := amount_total + rec.amount_cents;
    IF NOT dry_run THEN
      INSERT INTO purchase_reversals(source_table, source_id, user_id, credits_reversed, amount_cents, currency, reversed_by, reason)
      VALUES ('track_purchases', rec.id, rec.user_id, 0, rec.amount_cents, rec.currency, caller, 'boss_power_panel');
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'dry_run', dry_run,
    'window_minutes', window_minutes,
    'cutoff', cutoff,
    'credit_purchases_reversed', cp_count,
    'track_purchases_reversed', tp_count,
    'credits_refunded', credits_total,
    'amount_cents_affected', amount_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_recent_purchases(integer, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reverse_recent_purchases(integer, boolean) TO authenticated;
