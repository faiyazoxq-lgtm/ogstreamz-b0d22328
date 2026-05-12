ALTER TABLE public.boss_contacts
  ADD COLUMN linked_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_boss_contacts_linked_user_id
  ON public.boss_contacts(linked_user_id);