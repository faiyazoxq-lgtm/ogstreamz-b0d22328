
create table public.vip_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  title text not null,
  body text not null,
  link_url text,
  severity text not null default 'info',
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create index vip_notifications_created_at_idx on public.vip_notifications (created_at desc);
create index vip_notifications_user_id_idx on public.vip_notifications (user_id);

create table public.vip_notification_reads (
  notification_id uuid not null references public.vip_notifications(id) on delete cascade,
  user_id uuid not null,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

alter table public.vip_notifications enable row level security;
alter table public.vip_notification_reads enable row level security;

create policy "VIPs read targeted or broadcast notifications"
on public.vip_notifications for select
to authenticated
using (
  (public.is_real_og(auth.uid()) and (user_id is null or user_id = auth.uid()))
  or public.is_boss(auth.uid())
  or public.has_role(auth.uid(), 'admin'::app_role)
);

create policy "Boss inserts notifications"
on public.vip_notifications for insert
to authenticated
with check (public.is_boss(auth.uid()) or public.has_role(auth.uid(), 'admin'::app_role));

create policy "Boss deletes notifications"
on public.vip_notifications for delete
to authenticated
using (public.is_boss(auth.uid()) or public.has_role(auth.uid(), 'admin'::app_role));

create policy "Users manage own notification reads"
on public.vip_notification_reads for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

alter publication supabase_realtime add table public.vip_notifications;
