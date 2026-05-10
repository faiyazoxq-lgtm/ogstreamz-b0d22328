-- 1. telegram_user_links
create table public.telegram_user_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  chat_id bigint unique,
  tg_username text,
  link_code text unique,
  code_expires_at timestamptz,
  linked_at timestamptz,
  notify_purchases boolean not null default true,
  notify_reminders boolean not null default true,
  notify_live boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_telegram_user_links_chat on public.telegram_user_links(chat_id) where chat_id is not null;

alter table public.telegram_user_links enable row level security;

create policy "Users read own telegram link"
  on public.telegram_user_links for select to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own telegram link"
  on public.telegram_user_links for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own telegram link"
  on public.telegram_user_links for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users delete own telegram link"
  on public.telegram_user_links for delete to authenticated
  using (auth.uid() = user_id);

create policy "Boss manages telegram links"
  on public.telegram_user_links for all to authenticated
  using (public.is_boss(auth.uid()) or public.has_role(auth.uid(),'admin'::app_role))
  with check (public.is_boss(auth.uid()) or public.has_role(auth.uid(),'admin'::app_role));

create trigger trg_telegram_user_links_touch
  before update on public.telegram_user_links
  for each row execute function public.touch_updated_at();

-- 2. telegram_pass_reminders
create table public.telegram_pass_reminders (
  id uuid primary key default gen_random_uuid(),
  pass_id uuid not null references public.vip_passes(id) on delete cascade,
  user_id uuid not null,
  kind text not null check (kind in ('7d','1d','expired')),
  sent_at timestamptz not null default now(),
  unique (pass_id, kind)
);

create index idx_tg_pass_reminders_user on public.telegram_pass_reminders(user_id);

alter table public.telegram_pass_reminders enable row level security;

create policy "Users view own reminders"
  on public.telegram_pass_reminders for select to authenticated
  using (auth.uid() = user_id);

create policy "Boss manages reminders"
  on public.telegram_pass_reminders for all to authenticated
  using (public.is_boss(auth.uid()) or public.has_role(auth.uid(),'admin'::app_role))
  with check (public.is_boss(auth.uid()) or public.has_role(auth.uid(),'admin'::app_role));

-- 3. Webhook-callable claim function (security definer; bypasses RLS).
create or replace function public.claim_telegram_link_code(
  _code text, _chat_id bigint, _tg_username text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  row public.telegram_user_links;
begin
  if _code is null or length(trim(_code)) < 4 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  select * into row from public.telegram_user_links
    where link_code = upper(trim(_code)) for update;
  if row.user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if row.code_expires_at is not null and row.code_expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  -- if some other account already owns this chat_id, release it
  delete from public.telegram_user_links
    where chat_id = _chat_id and user_id <> row.user_id;

  update public.telegram_user_links
    set chat_id = _chat_id,
        tg_username = nullif(trim(_tg_username),''),
        linked_at = now(),
        link_code = null,
        code_expires_at = null,
        updated_at = now()
    where user_id = row.user_id;

  return jsonb_build_object('ok', true, 'user_id', row.user_id);
end $$;

revoke all on function public.claim_telegram_link_code(text, bigint, text) from public;
grant execute on function public.claim_telegram_link_code(text, bigint, text) to service_role;

-- 4. Purchases summary for the caller (used by /account/passes + dashboard widget).
create or replace function public.get_user_purchases_summary()
returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare
  uid uuid := auth.uid();
  passes jsonb;
  orders jsonb;
  credits jsonb;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select coalesce(jsonb_agg(to_jsonb(p) order by p.expires_at desc), '[]'::jsonb)
    into passes
    from public.vip_passes p
   where p.user_id = uid;

  select coalesce(jsonb_agg(to_jsonb(o) order by o.created_at desc), '[]'::jsonb)
    into orders
    from public.pass_orders o
   where o.user_id = uid;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc), '[]'::jsonb)
    into credits
    from public.credit_purchases c
   where c.user_id = uid;

  return jsonb_build_object(
    'passes', passes,
    'orders', orders,
    'credit_purchases', credits
  );
end $$;

grant execute on function public.get_user_purchases_summary() to authenticated;