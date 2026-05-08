
-- JOKES
create table public.jokes (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  source text,
  keyword text,
  created_by uuid,
  published boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.jokes enable row level security;
create policy "Anyone can view published jokes" on public.jokes for select using (published = true);
create policy "Admins can view all jokes" on public.jokes for select to authenticated using (has_role(auth.uid(), 'admin'));
create policy "Admins can insert jokes" on public.jokes for insert to authenticated with check (has_role(auth.uid(), 'admin'));
create policy "Admins can update jokes" on public.jokes for update to authenticated using (has_role(auth.uid(), 'admin'));
create policy "Admins can delete jokes" on public.jokes for delete to authenticated using (has_role(auth.uid(), 'admin'));

-- CALCULATORS
create table public.calculators (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  config jsonb not null default '{}'::jsonb,
  vip boolean not null default false,
  published boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.calculators enable row level security;
create policy "Anyone can view published calculators" on public.calculators for select using (published = true);
create policy "Admins manage calculators" on public.calculators for all to authenticated using (has_role(auth.uid(), 'admin')) with check (has_role(auth.uid(), 'admin'));

-- CREDIT LEDGER
create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);
alter table public.credit_ledger enable row level security;
create policy "Members view own ledger" on public.credit_ledger for select to authenticated using (auth.uid() = user_id);
create policy "Admins view all ledger" on public.credit_ledger for select to authenticated using (has_role(auth.uid(), 'admin'));

-- CUSTOM TRACK REQUESTS
create table public.custom_track_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  vibe text not null,
  notes text,
  status text not null default 'pending',
  deliverable_url text,
  credits_spent integer not null default 50,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.custom_track_requests enable row level security;
create policy "Members view own requests" on public.custom_track_requests for select to authenticated using (auth.uid() = user_id);
create policy "Members create own requests" on public.custom_track_requests for insert to authenticated with check (auth.uid() = user_id);
create policy "Admins view all requests" on public.custom_track_requests for select to authenticated using (has_role(auth.uid(), 'admin'));
create policy "Admins update all requests" on public.custom_track_requests for update to authenticated using (has_role(auth.uid(), 'admin'));

create trigger touch_custom_track_requests before update on public.custom_track_requests
for each row execute function public.touch_updated_at();

-- SPEND CREDITS RPC (atomic)
create or replace function public.spend_credits(_amount integer, _reason text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
  new_balance integer;
  uid uuid := auth.uid();
  is_vip boolean;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if _amount <= 0 then
    raise exception 'Invalid amount';
  end if;

  select credits, status = 'vip' into current_balance, is_vip from public.profiles where id = uid for update;

  -- VIP (Boss Pack) bypass for small spends
  if is_vip and _amount <= 5 then
    insert into public.credit_ledger (user_id, delta, reason) values (uid, 0, _reason || ' (vip)');
    return current_balance;
  end if;

  if current_balance < _amount then
    raise exception 'Insufficient credits' using errcode = 'P0001';
  end if;

  new_balance := current_balance - _amount;
  update public.profiles set credits = new_balance, updated_at = now() where id = uid;
  insert into public.credit_ledger (user_id, delta, reason) values (uid, -_amount, _reason);
  return new_balance;
end;
$$;
