
-- Storage bucket for cinematic portal backgrounds (public)
insert into storage.buckets (id, name, public)
values ('portals-media', 'portals-media', true)
on conflict (id) do update set public = true;

-- Public read; admin-only writes
drop policy if exists "Portals media public read" on storage.objects;
create policy "Portals media public read"
  on storage.objects for select
  using (bucket_id = 'portals-media');

drop policy if exists "Admins write portals media" on storage.objects;
create policy "Admins write portals media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'portals-media' and public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins update portals media" on storage.objects;
create policy "Admins update portals media"
  on storage.objects for update to authenticated
  using (bucket_id = 'portals-media' and public.has_role(auth.uid(), 'admin'));

-- Cinema columns on portals
alter table public.portals
  add column if not exists bg_video_url text,
  add column if not exists bg_video_aspect text not null default '16:9',
  add column if not exists bg_video_prompt text;
