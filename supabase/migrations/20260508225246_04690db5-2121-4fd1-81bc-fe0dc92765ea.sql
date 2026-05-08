-- 1) Subscriptions table for Stripe VIP subscription
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  stripe_subscription_id text not null unique,
  stripe_customer_id text not null,
  product_id text,
  price_id text not null,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  environment text not null default 'sandbox',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);
create index if not exists idx_subscriptions_stripe_id on public.subscriptions(stripe_subscription_id);

alter table public.subscriptions enable row level security;

drop policy if exists "Users can view own subscription" on public.subscriptions;
create policy "Users can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "Admins view all subscriptions" on public.subscriptions;
create policy "Admins view all subscriptions"
  on public.subscriptions for select
  using (public.has_role(auth.uid(), 'admin'));

create or replace function public.has_active_vip(_user uuid default auth.uid(), _env text default 'sandbox')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = _user
      and s.environment = _env
      and (
        (s.status in ('active','trialing','past_due') and (s.current_period_end is null or s.current_period_end > now()))
        or (s.status = 'canceled' and s.current_period_end > now())
      )
  )
  or exists (
    select 1 from public.profiles p where p.id = _user and p.status = 'vip'
  );
$$;

-- 2) Portal marketing table — auto-built on every spawn
create table if not exists public.portal_marketing (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null,
  portal_slug text not null,
  expanded_pitch text,
  audience_icp text,
  apollo_filters jsonb not null default '{}'::jsonb,
  email_subject text,
  email_body text,
  telegram_caption text,
  hashtags text[] not null default '{}',
  seo_title text,
  seo_description text,
  status text not null default 'pending',
  telegram_message_id text,
  campaign_id uuid,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_portal_marketing_portal on public.portal_marketing(portal_id);
create index if not exists idx_portal_marketing_status on public.portal_marketing(status);

alter table public.portal_marketing enable row level security;

drop policy if exists "Public can read portal marketing" on public.portal_marketing;
create policy "Public can read portal marketing"
  on public.portal_marketing for select
  using (true);

drop policy if exists "Admins manage portal marketing" on public.portal_marketing;
create policy "Admins manage portal marketing"
  on public.portal_marketing for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create trigger trg_portal_marketing_touch
before update on public.portal_marketing
for each row execute function public.touch_updated_at();

create trigger trg_subscriptions_touch
before update on public.subscriptions
for each row execute function public.touch_updated_at();