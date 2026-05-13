ALTER TABLE public.boss_todos ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS boss_todos_due_at_idx ON public.boss_todos (due_at) WHERE due_at IS NOT NULL;