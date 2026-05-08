
-- Credit pack purchases (idempotent log)
create table public.credit_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_session_id text not null unique,
  price_id text not null,
  credits_granted integer not null check (credits_granted >= 0),
  amount_cents integer not null,
  currency text not null default 'usd',
  environment text not null default 'sandbox',
  created_at timestamptz not null default now()
);

create index idx_credit_purchases_user_id on public.credit_purchases(user_id);

alter table public.credit_purchases enable row level security;

create policy "Members can view their own purchases"
  on public.credit_purchases for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Admins can view all purchases"
  on public.credit_purchases for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Subscriptions (VIP membership)
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
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

create index idx_subscriptions_user_id on public.subscriptions(user_id);

alter table public.subscriptions enable row level security;

create policy "Members can view their own subscription"
  on public.subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Admins can view all subscriptions"
  on public.subscriptions for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- Atomic, idempotent: log purchase + add credits to profile.
create or replace function public.apply_credit_purchase(
  _user_id uuid,
  _stripe_session_id text,
  _price_id text,
  _credits integer,
  _amount_cents integer,
  _currency text,
  _environment text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted boolean;
begin
  insert into public.credit_purchases
    (user_id, stripe_session_id, price_id, credits_granted, amount_cents, currency, environment)
  values
    (_user_id, _stripe_session_id, _price_id, _credits, _amount_cents, _currency, _environment)
  on conflict (stripe_session_id) do nothing;

  get diagnostics inserted = row_count;
  if inserted then
    update public.profiles
      set credits = credits + _credits, updated_at = now()
      where id = _user_id;
    return true;
  end if;
  return false;
end;
$$;

-- Allow profiles to be inserted by service role / auth flow (handle_new_user already does this via SECURITY DEFINER).
-- No additional grants required.
