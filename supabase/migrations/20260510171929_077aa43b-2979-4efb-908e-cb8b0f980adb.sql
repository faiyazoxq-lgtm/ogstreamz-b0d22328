create or replace function public.purchase_with_coins(_kind text, _ref text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cost int := 0;
  bal int;
  newbal int;
  fake_session text;
  tr public.tracks;
  pr public.store_products;
  already_owned boolean;
  detail jsonb;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  fake_session := 'coins:' || gen_random_uuid()::text;

  -- Resolve cost per kind
  if _kind = 'track_unlock' then
    select * into tr from public.tracks where id = _ref::uuid;
    if tr.id is null then raise exception 'Track not found'; end if;
    cost := greatest(1, ceil(tr.price_cents::numeric / 100)::int);

    select exists(select 1 from public.track_purchases
                  where user_id = uid and track_id = tr.id) into already_owned;
    if already_owned then
      return jsonb_build_object('ok', true, 'kind', _kind,
                                'balance', (select credits from public.profiles where id = uid),
                                'cost', 0, 'already', true);
    end if;

  elsif _kind = 'real_og' then
    cost := 20;

  elsif _kind = 'store_pass' then
    select * into pr from public.store_products where id = _ref::uuid;
    if pr.id is null or not pr.active then raise exception 'Product unavailable'; end if;
    if pr.kind not in ('vip_pass','streams_pass') then raise exception 'Unsupported product kind'; end if;
    if coalesce(pr.duration_days, 0) <= 0 then raise exception 'Product missing duration'; end if;
    cost := greatest(1, ceil(pr.price_cents::numeric / 100)::int);

  else
    raise exception 'Unknown purchase kind: %', _kind;
  end if;

  -- Lock + balance check
  select credits into bal from public.profiles where id = uid for update;
  if bal is null then raise exception 'Profile not found'; end if;

  if bal < cost then
    return jsonb_build_object('ok', false, 'error', 'insufficient',
                              'balance', bal, 'cost', cost);
  end if;

  newbal := bal - cost;
  update public.profiles set credits = newbal, updated_at = now() where id = uid;
  insert into public.credit_ledger (user_id, delta, reason)
    values (uid, -cost, 'purchase:' || _kind);

  -- Grant entitlement (any failure rolls the deduction back)
  if _kind = 'track_unlock' then
    insert into public.track_purchases (user_id, track_id, stripe_session_id,
                                        amount_cents, currency, environment)
      values (uid, tr.id, fake_session, cost * 100, 'gbp', 'coins');
    return jsonb_build_object('ok', true, 'kind', _kind,
                              'balance', newbal, 'cost', cost);

  elsif _kind = 'real_og' then
    detail := public.claim_real_og_pass(uid, fake_session, cost * 100, 'gbp', 'coins');
    return jsonb_build_object('ok', true, 'kind', _kind,
                              'balance', newbal, 'cost', cost, 'detail', detail);

  elsif _kind = 'store_pass' then
    insert into public.pass_orders (user_id, product_id, kind, duration_days,
                                    amount_cents, currency, stripe_session_id,
                                    environment, status)
      values (uid, pr.id, pr.kind, pr.duration_days, cost * 100,
              lower(coalesce(pr.currency, 'gbp')), fake_session,
              'coins', 'pending_approval');
    return jsonb_build_object('ok', true, 'kind', _kind,
                              'balance', newbal, 'cost', cost,
                              'pending_approval', true);
  end if;

  return jsonb_build_object('ok', false, 'error', 'unhandled');
end;
$$;

revoke all on function public.purchase_with_coins(text, text) from public, anon;
grant execute on function public.purchase_with_coins(text, text) to authenticated;