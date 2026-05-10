-- ----------------------------------------------------------------
-- Real OG one-off pass — auto-issue (no boss approval needed)
-- ----------------------------------------------------------------

-- Allow 'real_og' as an order kind alongside vip_pass / streams_pass
alter table public.pass_orders drop constraint pass_orders_kind_check;
alter table public.pass_orders add constraint pass_orders_kind_check
  check (kind in ('vip_pass','streams_pass','real_og'));

-- Catalog row for the £20 lifetime Real OG pass
insert into public.store_products
  (sku, kind, title, description, price_cents, currency, duration_days, sort_order, metadata)
values
  ('real_og', 'vip_pass',
   'Real OG Pass',
   'One-off £20. Lifetime Real OG status — top-shelf access, prestige badge, unlimited tools.',
   2000, 'gbp', 36500, 1,
   jsonb_build_object('real_og', true, 'lifetime', true, 'auto_issue', true))
on conflict (sku) do update set
  title = excluded.title,
  description = excluded.description,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  duration_days = excluded.duration_days,
  metadata = excluded.metadata,
  active = true;

-- Atomic claim function — called from the Stripe webhook after a paid Real OG checkout.
create or replace function public.claim_real_og_pass(
  _user_id uuid,
  _stripe_session_id text,
  _amount_cents integer,
  _currency text,
  _environment text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  prod public.store_products;
  existing public.pass_orders;
  serial_num bigint;
  pass_num text;
  pass_id uuid;
  expiry timestamptz;
  current_flags jsonb;
begin
  -- Idempotency: if we've already issued for this session, return the existing pass.
  select * into existing from public.pass_orders where stripe_session_id = _stripe_session_id;
  if existing.id is not null then
    return jsonb_build_object(
      'status', existing.status,
      'pass_number', existing.pass_number,
      'order_id', existing.id,
      'already', true
    );
  end if;

  select * into prod from public.store_products where sku = 'real_og';
  if prod.id is null then raise exception 'real_og product missing'; end if;

  serial_num := nextval('public.vip_pass_serial');
  pass_num := 'OG-' || lpad(serial_num::text, 6, '0');
  expiry := now() + interval '100 years';

  insert into public.vip_passes (user_id, granted_by, source, notes, expires_at)
    values (_user_id, _user_id,
            'store:real_og:' || pass_num,
            'Real OG Lifetime Pass — auto-issued', expiry)
    returning id into pass_id;

  insert into public.pass_orders
    (user_id, product_id, kind, duration_days, amount_cents, currency,
     stripe_session_id, environment, status, pass_number, issued_pass_id,
     boss_decision_note, decided_at)
  values
    (_user_id, prod.id, 'real_og', 36500, _amount_cents, lower(_currency),
     _stripe_session_id, _environment, 'issued', pass_num, pass_id,
     'auto-issue', now());

  -- Promote profile: status=vip, rank=vip (unless boss), feature_flags.real_og=true
  select coalesce(feature_flags, '{}'::jsonb) into current_flags
    from public.profiles where id = _user_id;

  update public.profiles
    set status = 'vip'::account_status,
        rank = case when rank = 'boss'::syndicate_rank then rank else 'vip'::syndicate_rank end,
        feature_flags = coalesce(current_flags, '{}'::jsonb)
                        || jsonb_build_object('real_og', true,
                                              'real_og_since', to_jsonb(now()),
                                              'real_og_pass', to_jsonb(pass_num)),
        updated_at = now()
    where id = _user_id;

  return jsonb_build_object(
    'status', 'issued',
    'pass_number', pass_num,
    'order_id', (select id from public.pass_orders where stripe_session_id = _stripe_session_id),
    'pass_id', pass_id,
    'expires_at', expiry,
    'already', false
  );
end;
$$;

revoke all on function public.claim_real_og_pass(uuid, text, integer, text, text) from public, anon, authenticated;
