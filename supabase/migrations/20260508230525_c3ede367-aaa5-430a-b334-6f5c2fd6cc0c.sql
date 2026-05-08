create table if not exists public.signal_bundles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portal_slug text not null,
  channel_chat_id text not null,
  intro_message_id bigint,
  signal_payload jsonb not null default '{}'::jsonb,
  compliance_badge text not null default 'SENTIMENT ANALYSIS ONLY — NOT A DIRECT FINANCIAL PROMOTION (FCA CP26/13)',
  suno_task_id text,
  suno_audio_url text,
  suno_message_id bigint,
  veo_operation text,
  veo_video_url text,
  veo_message_id bigint,
  status text not null default 'pending' check (status in ('pending','partial','complete','failed')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.suno_jobs add column if not exists signal_bundle_id uuid references public.signal_bundles(id) on delete set null;
create index if not exists idx_suno_jobs_signal_bundle on public.suno_jobs(signal_bundle_id);
create index if not exists idx_signal_bundles_user on public.signal_bundles(user_id);
create index if not exists idx_signal_bundles_status on public.signal_bundles(status);

alter table public.signal_bundles enable row level security;

create policy "Users see own bundles" on public.signal_bundles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "Admins manage bundles" on public.signal_bundles for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create trigger trg_signal_bundles_touch before update on public.signal_bundles
  for each row execute function public.touch_updated_at();