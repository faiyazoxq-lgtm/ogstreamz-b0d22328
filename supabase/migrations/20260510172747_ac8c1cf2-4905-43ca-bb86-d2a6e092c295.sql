do $$
begin
  begin
    alter publication supabase_realtime add table public.profiles;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.credit_ledger;
  exception when duplicate_object then null;
  end;
end $$;

alter table public.profiles replica identity full;
alter table public.credit_ledger replica identity full;