
-- Pool of VIP pass codes the boss curates
create table if not exists public.vip_pass_pool (
  id uuid primary key default gen_random_uuid(),
  label text not null default '',
  code text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vip_pass_pool_active_idx on public.vip_pass_pool (active, sort_order);

alter table public.vip_pass_pool enable row level security;

create policy "Boss manages vip pass pool"
  on public.vip_pass_pool
  for all
  to authenticated
  using (public.is_boss(auth.uid()) or public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.is_boss(auth.uid()) or public.has_role(auth.uid(), 'admin'::app_role));

create trigger trg_vip_pass_pool_touch
  before update on public.vip_pass_pool
  for each row execute function public.touch_updated_at();

-- Per-user current reveal
create table if not exists public.vip_pass_reveals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  pool_id uuid not null references public.vip_pass_pool(id) on delete cascade,
  revealed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists vip_pass_reveals_user_idx
  on public.vip_pass_reveals (user_id, revealed_at desc);

alter table public.vip_pass_reveals enable row level security;

create policy "Users read own reveals"
  on public.vip_pass_reveals
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_boss(auth.uid()) or public.has_role(auth.uid(), 'admin'::app_role));

-- Reveal: returns the user's current unexpired pass, or picks a fresh random one
create or replace function public.reveal_vip_pass()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  cur public.vip_pass_reveals;
  pool_row public.vip_pass_pool;
  pool_size int;
  ttl_secs int := 900; -- 15 minutes
  expiry timestamptz;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not public.is_real_og(uid) then
    raise exception 'Real OG / VIP pass required' using errcode = '42501';
  end if;

  -- Re-issue the still-valid one if user already has an active reveal
  select r.* into cur
    from public.vip_pass_reveals r
    join public.vip_pass_pool p on p.id = r.pool_id
   where r.user_id = uid
     and r.expires_at > now()
     and p.active = true
   order by r.revealed_at desc
   limit 1;

  if cur.id is not null then
    select * into pool_row from public.vip_pass_pool where id = cur.pool_id;
    select count(*) into pool_size from public.vip_pass_pool where active = true;
    return jsonb_build_object(
      'available', true,
      'label', pool_row.label,
      'code', pool_row.code,
      'revealed_at', cur.revealed_at,
      'expires_at', cur.expires_at,
      'expires_in', greatest(0, extract(epoch from (cur.expires_at - now()))::int),
      'pool_size', pool_size
    );
  end if;

  select count(*) into pool_size from public.vip_pass_pool where active = true;
  if pool_size = 0 then
    return jsonb_build_object(
      'available', false,
      'reason', 'No VIP passes loaded yet — check back soon.',
      'pool_size', 0
    );
  end if;

  -- Pick a random active pass
  select * into pool_row
    from public.vip_pass_pool
   where active = true
   order by random()
   limit 1;

  expiry := now() + (ttl_secs || ' seconds')::interval;

  insert into public.vip_pass_reveals (user_id, pool_id, revealed_at, expires_at)
    values (uid, pool_row.id, now(), expiry);

  return jsonb_build_object(
    'available', true,
    'label', pool_row.label,
    'code', pool_row.code,
    'revealed_at', now(),
    'expires_at', expiry,
    'expires_in', ttl_secs,
    'pool_size', pool_size
  );
end;
$$;

revoke execute on function public.reveal_vip_pass() from anon, public;
grant execute on function public.reveal_vip_pass() to authenticated;

-- Boss CRUD helpers
create or replace function public.boss_upsert_vip_pass_pool(
  _id uuid,
  _label text,
  _code text,
  _active boolean,
  _sort_order integer
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare out_id uuid;
begin
  if not (public.is_boss(auth.uid()) or public.has_role(auth.uid(), 'admin'::app_role)) then
    raise exception 'Boss only';
  end if;
  if _code is null or length(trim(_code)) = 0 then
    raise exception 'Code required';
  end if;

  if _id is null then
    insert into public.vip_pass_pool (label, code, active, sort_order, created_by)
      values (coalesce(_label, ''), trim(_code),
              coalesce(_active, true), coalesce(_sort_order, 0), auth.uid())
      returning id into out_id;
  else
    update public.vip_pass_pool
      set label = coalesce(_label, label),
          code = trim(_code),
          active = coalesce(_active, active),
          sort_order = coalesce(_sort_order, sort_order),
          updated_at = now()
      where id = _id
      returning id into out_id;
    if out_id is null then raise exception 'Pass not found'; end if;
  end if;
  return out_id;
end;
$$;

revoke execute on function public.boss_upsert_vip_pass_pool(uuid, text, text, boolean, integer) from anon, public;
grant execute on function public.boss_upsert_vip_pass_pool(uuid, text, text, boolean, integer) to authenticated;

create or replace function public.boss_delete_vip_pass_pool(_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not (public.is_boss(auth.uid()) or public.has_role(auth.uid(), 'admin'::app_role)) then
    raise exception 'Boss only';
  end if;
  delete from public.vip_pass_pool where id = _id;
  return found;
end;
$$;

revoke execute on function public.boss_delete_vip_pass_pool(uuid) from anon, public;
grant execute on function public.boss_delete_vip_pass_pool(uuid) to authenticated;
