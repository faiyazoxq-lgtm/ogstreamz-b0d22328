ALTER TABLE public.pass_orders DROP CONSTRAINT IF EXISTS pass_orders_status_check;
ALTER TABLE public.pass_orders ADD CONSTRAINT pass_orders_status_check
  CHECK (status = ANY (ARRAY[
    'checkout_opened'::text,
    'pending_approval'::text,
    'approved'::text,
    'denied'::text,
    'issued'::text,
    'refunded'::text,
    'delivered'::text
  ]));