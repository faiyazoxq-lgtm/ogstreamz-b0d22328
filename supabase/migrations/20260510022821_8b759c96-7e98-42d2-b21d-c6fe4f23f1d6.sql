-- ============================================================
-- Store v2: products catalog, pass orders, Telegram linking
-- ============================================================

-- 1) Generic product catalog
create table public.store_products (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  kind text not null check (kind in ('vip_pass','streams_pass','digital','nft')),
  title text not null,
  description text,
  image_url text,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'usd',
  duration_days integer,
  asset_url text,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.store_products enable row level security;

create policy "Public read active store products"
  on public.store_products for select
  using (active = true or is_boss(auth.uid()) or has_role(auth.uid(), 'admin'::app_role));

create policy "Boss manages store products"
  on public.store_products for all
  to authenticated
  using (is_boss(auth.uid()) or has_role(auth.uid(), 'admin'::app_role))
  with check (is_boss(auth.uid()) or has_role(auth.uid(), 'admin'::app_role));

create trigger trg_store_products_touch
  before update on public.store_products
  for each row execute function public.touch_updated_at();

-- 2) Pass orders awaiting Boss approval
create table public.pass_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  product_id uuid not null references public.store_products(id) on delete restrict,
  kind text not null check (kind in ('vip_pass','streams_pass')),
  duration_days integer not null check (duration_days > 0),
  amount_cents integer not null,
  currency text not null default 'usd',
  stripe_session_id text unique not null,
  stripe_payment_intent text,
  environment text not null default 'sandbox',
  status text not null default 'pending_approval'
    check (status in ('pending_approval','approved','denied','issued','refunded')),
  pass_number text,
  issued_pass_id uuid references public.vip_passes(id) on delete set null,
  boss_decision_note text,
  decided_by uuid,
  decided_at timestamptz,
  telegram_alert_msg_id text,
  user_chat_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pass_orders_user_idx on public.pass_orders(user_id, created_at desc);
create index pass_orders_status_idx on public.pass_orders(status, created_at desc);

alter table public.pass_orders enable row level security;

create policy "Members read own pass orders"
  on public.pass_orders for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Boss reads all pass orders"
  on public.pass_orders for select
  to authenticated
  using (is_boss(auth.uid()) or has_role(auth.uid(), 'admin'::app_role));

create policy "Boss updates pass orders"
  on public.pass_orders for update
  to authenticated
  using (is_boss(auth.uid()) or has_role(auth.uid(), 'admin'::app_role))
  with check (is_boss(auth.uid()) or has_role(auth.uid(), 'admin'::app_role));

-- INSERT happens from the webhook via service role (bypasses RLS) — no INSERT policy needed.

create trigger trg_pass_orders_touch
  before update on public.pass_orders
  for each row execute function public.touch_updated_at();

-- 3) Telegram link table (one chat per user)
create table public.user_telegram_links (
  user_id uuid primary key,
  chat_id bigint not null,
  username text,
  first_name text,
  linked_at timestamptz not null default now()
);

create unique index user_telegram_links_chat_idx on public.user_telegram_links(chat_id);

alter table public.user_telegram_links enable row level security;

create policy "Members read own telegram link"
  on public.user_telegram_links for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Boss reads all telegram links"
  on public.user_telegram_links for select
  to authenticated
  using (is_boss(auth.uid()) or has_role(auth.uid(), 'admin'::app_role));

create policy "Members delete own telegram link"
  on public.user_telegram_links for delete
  to authenticated
  using (auth.uid() = user_id);

-- INSERTs happen from the bot webhook via service role; no insert policy needed.

-- 4) One-time deep-link tokens
create table public.telegram_link_tokens (
  token text primary key,
  user_id uuid not null,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index telegram_link_tokens_user_idx on public.telegram_link_tokens(user_id, created_at desc);

alter table public.telegram_link_tokens enable row level security;

create policy "Members manage own link tokens"
  on public.telegram_link_tokens for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 5) Monotonic pass serial
create sequence public.vip_pass_serial start 1000;

-- 6) Boss approval RPC
create or replace function public.boss_decide_pass_order(
  _order_id uuid,
  _approve boolean,
  _note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ord public.pass_orders;
  serial_num bigint;
  prefix text;
  pass_num text;
  pass_id uuid;
  expiry timestamptz;
begin
  if not (is_boss(auth.uid()) or has_role(auth.uid(), 'admin'::app_role)) then
    raise exception 'Boss only';
  end if;

  select * into ord from public.pass_orders where id = _order_id for update;
  if ord.id is null then raise exception 'Order not found'; end if;
  if ord.status not in ('pending_approval') then
    raise exception 'Order already decided (status=%)', ord.status;
  end if;

  if not _approve then
    update public.pass_orders
      set status = 'denied',
          boss_decision_note = coalesce(left(_note, 500), ''),
          decided_by = auth.uid(),
          decided_at = now()
      where id = ord.id;
    return jsonb_build_object('status','denied','order_id',ord.id,'user_id',ord.user_id,'chat_id',ord.user_chat_id);
  end if;

  serial_num := nextval('public.vip_pass_serial');
  prefix := case when ord.kind = 'streams_pass' then 'STR-' else 'VIP-' end;
  pass_num := prefix || lpad(serial_num::text, 6, '0');
  expiry := now() + (ord.duration_days || ' days')::interval;

  insert into public.vip_passes (user_id, granted_by, source, notes, expires_at)
    values (ord.user_id, auth.uid(),
            'store:' || ord.kind || ':' || pass_num,
            coalesce(left(_note, 500), ''), expiry)
    returning id into pass_id;

  if ord.kind = 'vip_pass' then
    update public.profiles
      set status = 'vip'::account_status,
          rank = case when rank = 'boss'::syndicate_rank then rank else 'vip'::syndicate_rank end,
          updated_at = now()
      where id = ord.user_id;
  end if;

  update public.pass_orders
    set status = 'issued',
        pass_number = pass_num,
        issued_pass_id = pass_id,
        boss_decision_note = coalesce(left(_note, 500), ''),
        decided_by = auth.uid(),
        decided_at = now()
    where id = ord.id;

  return jsonb_build_object(
    'status','issued',
    'order_id', ord.id,
    'user_id', ord.user_id,
    'chat_id', ord.user_chat_id,
    'pass_number', pass_num,
    'pass_id', pass_id,
    'expires_at', expiry,
    'kind', ord.kind
  );
end;
$$;

grant execute on function public.boss_decide_pass_order(uuid, boolean, text) to authenticated;

-- 7) Realtime for pass_orders so the user's return page can react instantly.
alter table public.pass_orders replica identity full;
alter publication supabase_realtime add table public.pass_orders;

-- 8) Seed the default catalog (idempotent — uses sku conflict)
insert into public.store_products (sku, kind, title, description, price_cents, duration_days, sort_order)
values
  ('vip_7',     'vip_pass',     '7-Day VIP Pass',      'One week of full VIP access — unlimited scans, premium tools, VIP rooms.', 1900, 7, 10),
  ('vip_30',    'vip_pass',     '30-Day VIP Pass',     'A full month of VIP access. Best value for active members.',               4900, 30, 20),
  ('vip_90',    'vip_pass',     '90-Day VIP Pass',     'Three months of VIP power. Lock in the discount.',                         11900, 90, 30),
  ('streams_7', 'streams_pass', '7-Day Streams Pass',  'One week of access to live Syndicate streams & rooms.',                    900, 7, 40),
  ('streams_30','streams_pass', '30-Day Streams Pass', 'A month of streams access — stay in the room.',                            2900, 30, 50)
on conflict (sku) do nothing;
