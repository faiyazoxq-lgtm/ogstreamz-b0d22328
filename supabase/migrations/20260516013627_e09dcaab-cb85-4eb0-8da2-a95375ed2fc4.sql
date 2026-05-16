CREATE OR REPLACE FUNCTION public.purchase_with_coins(_kind text, _ref text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  is_boss_caller boolean := false;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select public.is_boss(uid) into is_boss_caller;
  is_boss_caller := coalesce(is_boss_caller, false);

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

  -- Boss override: free, no balance change, auto-issue
  if is_boss_caller then
    select credits into bal from public.profiles where id = uid;

    if _kind = 'track_unlock' then
      insert into public.track_purchases (user_id, track_id, stripe_session_id,
                                          amount_cents, currency, environment)
        values (uid, tr.id, fake_session, 0, 'gbp', 'boss');
      return jsonb_build_object('ok', true, 'kind', _kind,
                                'balance', bal, 'cost', 0, 'boss_override', true);

    elsif _kind = 'real_og' then
      detail := public.claim_real_og_pass(uid, fake_session, 0, 'gbp', 'boss');
      return jsonb_build_object('ok', true, 'kind', _kind,
                                'balance', bal, 'cost', 0, 'detail', detail,
                                'boss_override', true);

    elsif _kind = 'store_pass' then
      insert into public.pass_orders (user_id, product_id, kind, duration_days,
                                      amount_cents, currency, stripe_session_id,
                                      environment, status, boss_decision_note, decided_at)
        values (uid, pr.id, pr.kind, pr.duration_days, 0,
                lower(coalesce(pr.currency, 'gbp')), fake_session,
                'boss', 'issued', 'boss-override auto-issue', now());
      return jsonb_build_object('ok', true, 'kind', _kind,
                                'balance', bal, 'cost', 0,
                                'pending_approval', false, 'boss_override', true);
    end if;
  end if;

  -- Lock + balance check (non-boss)
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
$function$;