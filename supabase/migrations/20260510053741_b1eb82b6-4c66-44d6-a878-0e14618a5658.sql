
create or replace function public.claim_real_og_bundle(
  _user_id uuid,
  _stripe_session_id text,
  _amount_cents integer,
  _currency text,
  _environment text,
  _bundle_sku text,
  _credits integer
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  prod public.store_products;
  existing_order public.pass_orders;
  serial_num bigint;
  pass_num text;
  pass_id uuid;
  expiry timestamptz;
  current_flags jsonb;
  credit_already boolean;
  pass_payload jsonb;
begin
  -- Idempotency on the OG pass side via pass_orders.stripe_session_id.
  select * into existing_order from public.pass_orders where stripe_session_id = _stripe_session_id;

  if existing_order.id is null then
    select * into prod from public.store_products where sku = 'real_og';
    if prod.id is null then raise exception 'real_og product missing'; end if;

    serial_num := nextval('public.vip_pass_serial');
    pass_num := 'OG-' || lpad(serial_num::text, 6, '0');
    expiry := now() + interval '100 years';

    insert into public.vip_passes (user_id, granted_by, source, notes, expires_at)
      values (_user_id, _user_id,
              'store:' || _bundle_sku || ':' || pass_num,
              'Real OG Bundle (' || _bundle_sku || ') — auto-issued', expiry)
      returning id into pass_id;

    insert into public.pass_orders
      (user_id, product_id, kind, duration_days, amount_cents, currency,
       stripe_session_id, environment, status, pass_number, issued_pass_id,
       boss_decision_note, decided_at)
    values
      (_user_id, prod.id, 'real_og', 36500, _amount_cents, lower(_currency),
       _stripe_session_id, _environment, 'issued', pass_num, pass_id,
       'auto-issue:bundle:' || _bundle_sku, now());

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

    pass_payload := jsonb_build_object('status','issued','pass_number',pass_num,'pass_id',pass_id);
  else
    pass_payload := jsonb_build_object('status', existing_order.status, 'pass_number', existing_order.pass_number, 'already', true);
  end if;

  -- Credits side — apply_credit_purchase is idempotent on stripe_session_id.
  if _credits is not null and _credits > 0 then
    select public.apply_credit_purchase(
      _user_id,
      _stripe_session_id,
      _bundle_sku,
      _credits,
      _amount_cents,
      lower(_currency),
      _environment
    ) into credit_already;
  end if;

  return jsonb_build_object(
    'pass', pass_payload,
    'credits_granted', coalesce(_credits, 0)
  );
end $$;
