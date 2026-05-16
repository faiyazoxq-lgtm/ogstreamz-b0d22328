-- Defense-in-depth: prevent any path from driving credits negative
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_credits_non_negative;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_credits_non_negative CHECK (credits >= 0) NOT VALID;

-- Replace the non-boss branch with a single atomic conditional UPDATE.
-- Boss override branch is unchanged (still free, audited, no credit mutation).
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
  item_title_v text;
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
    item_title_v := tr.title;

    select exists(select 1 from public.track_purchases
                  where user_id = uid and track_id = tr.id) into already_owned;
    if already_owned then
      return jsonb_build_object('ok', true, 'kind', _kind,
                                'balance', (select credits from public.profiles where id = uid),
                                'cost', 0, 'already', true);
    end if;

  elsif _kind = 'real_og' then
    cost := 20;
    item_title_v := 'Real OG Pass';

  elsif _kind = 'store_pass' then
    select * into pr from public.store_products where id = _ref::uuid;
    if pr.id is null or not pr.active then raise exception 'Product unavailable'; end if;
    if pr.kind not in ('vip_pass','streams_pass') then raise exception 'Unsupported product kind'; end if;
    if coalesce(pr.duration_days, 0) <= 0 then raise exception 'Product missing duration'; end if;
    cost := greatest(1, ceil(pr.price_cents::numeric / 100)::int);
    item_title_v := coalesce(pr.title, pr.kind);

  else
    raise exception 'Unknown purchase kind: %', _kind;
  end if;

  -- Boss override: free, no balance change, auto-issue + audit
  if is_boss_caller then
    select credits into bal from public.profiles where id = uid;

    if _kind = 'track_unlock' then
      insert into public.track_purchases (user_id, track_id, stripe_session_id,
                                          amount_cents, currency, environment)
        values (uid, tr.id, fake_session, 0, 'gbp', 'boss');

      insert into public.boss_purchase_audit
        (user_id, kind, ref_id, item_title, would_have_cost_credits, metadata)
        values (uid, _kind, tr.id::text, item_title_v, cost,
                jsonb_build_object('track_id', tr.id, 'price_cents', tr.price_cents));

      return jsonb_build_object('ok', true, 'kind', _kind,
                                'balance', bal, 'cost', 0, 'boss_override', true);

    elsif _kind = 'real_og' then
      detail := public.claim_real_og_pass(uid, fake_session, 0, 'gbp', 'boss');

      insert into public.boss_purchase_audit
        (user_id, kind, ref_id, item_title, would_have_cost_credits, metadata)
        values (uid, _kind, null, item_title_v, cost,
                coalesce(detail, '{}'::jsonb));

      return jsonb_build_object('ok', true, 'kind', _kind,
                                'balance', bal, 'cost', 0, 'detail', detail,
                                'boss_override', true);

    elsif _kind = 'store_pass' then
      insert into public.pass_orders (user_id, product_id, kind, duration_days,
                                      amount_cents, currency, stripe_session_id,
                                      environment, status, notes, issued_at)
        values (uid, pr.id, pr.kind, pr.duration_days, 0,
                lower(coalesce(pr.currency, 'gbp')), fake_session,
                'boss', 'issued', 'boss-override auto-issue', now());

      insert into public.boss_purchase_audit
        (user_id, kind, ref_id, item_title, would_have_cost_credits, metadata)
        values (uid, _kind, pr.id::text, item_title_v, cost,
                jsonb_build_object('product_id', pr.id, 'product_kind', pr.kind,
                                   'duration_days', pr.duration_days,
                                   'price_cents', pr.price_cents));

      return jsonb_build_object('ok', true, 'kind', _kind,
                                'balance', bal, 'cost', 0,
                                'pending_approval', false, 'boss_override', true);
    end if;
  end if;

  -- Atomic conditional deduction: single statement, no read-then-write race.
  -- Only updates if credits >= cost. RETURNING gives us the post-deduction balance.
  update public.profiles
     set credits = credits - cost
   where id = uid
     and credits >= cost
   returning credits into newbal;

  if newbal is null then
    -- Either the profile doesn't exist or balance was insufficient.
    select credits into bal from public.profiles where id = uid;
    if bal is null then raise exception 'Profile not found'; end if;
    return jsonb_build_object('ok', false, 'error', 'insufficient',
                              'balance', bal, 'cost', cost);
  end if;

  if _kind = 'track_unlock' then
    insert into public.track_purchases (user_id, track_id, stripe_session_id,
                                        amount_cents, currency, environment)
      values (uid, tr.id, fake_session, 0, 'gbp', 'coins');
    return jsonb_build_object('ok', true, 'kind', _kind,
                              'balance', newbal, 'cost', cost);

  elsif _kind = 'real_og' then
    detail := public.claim_real_og_pass(uid, fake_session, 0, 'gbp', 'coins');
    return jsonb_build_object('ok', true, 'kind', _kind,
                              'balance', newbal, 'cost', cost, 'detail', detail);

  elsif _kind = 'store_pass' then
    insert into public.pass_orders (user_id, product_id, kind, duration_days,
                                    amount_cents, currency, stripe_session_id,
                                    environment, status)
      values (uid, pr.id, pr.kind, pr.duration_days, 0,
              lower(coalesce(pr.currency, 'gbp')), fake_session,
              'coins', 'pending');
    return jsonb_build_object('ok', true, 'kind', _kind,
                              'balance', newbal, 'cost', cost,
                              'pending_approval', true);
  end if;

  return jsonb_build_object('ok', false, 'error', 'unreachable');
end;
$function$;