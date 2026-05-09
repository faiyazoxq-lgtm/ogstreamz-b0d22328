create table if not exists public.swear_lexicon (
  category text primary key,
  items text[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.swear_lexicon enable row level security;

create policy "Authenticated read swear lexicon"
  on public.swear_lexicon for select
  to authenticated using (true);

create policy "Boss writes swear lexicon"
  on public.swear_lexicon for all
  to authenticated
  using (is_boss(auth.uid()) or has_role(auth.uid(), 'admin'::app_role))
  with check (is_boss(auth.uid()) or has_role(auth.uid(), 'admin'::app_role));

insert into public.swear_lexicon (category, items) values
  ('heavy', array['fuck','fucking','shit','bullshit','twat','wanker','prick','bastard','arse','bollocks','dickhead','knobhead','gobshite']),
  ('mid', array['shit','piss','bastard','prick','arse','bollocks','dickhead']),
  ('soft', array['damn','hell','bloody','crap','sodding']),
  ('refusal_patterns', array[
    '\bi (?:can(?:''|no)?t|won''?t|am unable to|cannot)\b[^.!?]*[.!?]',
    '\b(?:as an? (?:ai|language model)|i''?m an ai)\b[^.!?]*[.!?]',
    '\bi (?:must|have to) (?:decline|refuse|apologi[sz]e)\b[^.!?]*[.!?]',
    '\b(?:sorry|apologies),?\s+but\b[^.!?]*[.!?]',
    '\b(?:please note|disclaimer|content warning)[^.!?]*[.!?]',
    '\bi (?:don''?t|do not) (?:use|condone|encourage) (?:profanity|swearing|foul language)\b[^.!?]*[.!?]'
  ]),
  ('brutal_openers', array[
    'Right, you absolute melt —',
    'Listen up, you knobhead —',
    'Oi gobshite,',
    'Fucking hell, ya muppet —',
    'Christ on a bike, you walnut —',
    'Sit down, ya soft prick —'
  ]),
  ('fillers_heavy', array[
    'no fucking arguments,',
    'shut your bollocks and listen,',
    'don''t be a wanker about it,',
    'stop being such a twat,',
    'and that''s the fucking truth,'
  ]),
  ('fillers_mid', array[
    'no piss-arsing about,',
    'stop being a prick,',
    'for arse''s sake,'
  ])
on conflict (category) do nothing;