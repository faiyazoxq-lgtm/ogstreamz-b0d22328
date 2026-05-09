drop policy if exists "Authenticated read swear lexicon" on public.swear_lexicon;
create policy "Public read swear lexicon"
  on public.swear_lexicon for select
  to public using (true);