
-- Subscription plan column on profiles
do $$
begin
  if not exists (select 1 from pg_type where typname = 'subscription_plan') then
    create type public.subscription_plan as enum ('free','metal','energy','syndicate');
  end if;
end $$;

alter table public.profiles
  add column if not exists subscription_plan public.subscription_plan not null default 'free';

-- Bot configs (pair channels managed by the master bot)
create table if not exists public.bot_configs (
  id uuid primary key default gen_random_uuid(),
  pair_name text not null,
  pair_label text not null,
  channel_chat_id text not null,
  tier_required public.subscription_plan not null default 'metal',
  update_frequency text not null default '15min',
  active boolean not null default true,
  asset_class text,
  bias text default 'neutral',
  last_pinged_at timestamptz,
  last_broadcast text,
  ping_count integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pair_name)
);

alter table public.bot_configs enable row level security;

create policy "Public read active bots"
  on public.bot_configs for select to public
  using (active = true);

create policy "Admins read all bots"
  on public.bot_configs for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins manage bots"
  on public.bot_configs for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create trigger trg_bot_configs_touch
  before update on public.bot_configs
  for each row execute function public.touch_updated_at();

-- Subscribers (Telegram user IDs linked to app users for kick/approve flows)
create table if not exists public.syndicate_subscribers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  telegram_user_id bigint,
  telegram_username text,
  plan public.subscription_plan not null default 'free',
  status text not null default 'active', -- active | canceled | kicked
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.syndicate_subscribers enable row level security;

create policy "Members view own subscriber row"
  on public.syndicate_subscribers for select to authenticated
  using (auth.uid() = user_id);

create policy "Admins read all subscribers"
  on public.syndicate_subscribers for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins manage subscribers"
  on public.syndicate_subscribers for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create trigger trg_subscribers_touch
  before update on public.syndicate_subscribers
  for each row execute function public.touch_updated_at();

-- Helper: does a plan grant access to a given required tier?
create or replace function public.plan_includes_tier(_plan public.subscription_plan, _required public.subscription_plan)
returns boolean
language sql
immutable
set search_path to public
as $$
  select case
    when _plan = 'syndicate' then true
    when _plan = _required then true
    else false
  end;
$$;
