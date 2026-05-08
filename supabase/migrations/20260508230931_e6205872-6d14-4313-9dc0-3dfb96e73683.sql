-- bot_factory: per-pair Telegram bot fleet
create table if not exists public.bot_factory (
  id uuid primary key default gen_random_uuid(),
  pair_name text not null,
  pair_label text not null default '',
  telegram_bot_token text not null,
  bot_username text,
  webhook_secret text not null default encode(gen_random_bytes(24), 'hex'),
  webhook_url text,
  channel_chat_id text not null default '',
  asset_class text,
  bias text not null default 'neutral',
  tier text not null default 'FREE' check (tier in ('FREE','PAID')),
  active boolean not null default true,
  last_pinged_at timestamptz,
  last_broadcast text,
  ping_count integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists bot_factory_pair_name_key on public.bot_factory (pair_name);

alter table public.bot_factory enable row level security;

create policy "Admins manage fleet bots"
  on public.bot_factory for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create trigger bot_factory_touch
  before update on public.bot_factory
  for each row execute function public.touch_updated_at();

-- fleet_settings: singleton row
create table if not exists public.fleet_settings (
  id integer primary key default 1,
  global_frequency text not null default 'aggressive' check (global_frequency in ('aggressive','passive')),
  updated_at timestamptz not null default now(),
  constraint fleet_settings_singleton check (id = 1)
);

insert into public.fleet_settings (id) values (1) on conflict do nothing;

alter table public.fleet_settings enable row level security;

create policy "Anyone can read fleet settings"
  on public.fleet_settings for select
  to public using (true);

create policy "Admins update fleet settings"
  on public.fleet_settings for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create trigger fleet_settings_touch
  before update on public.fleet_settings
  for each row execute function public.touch_updated_at();