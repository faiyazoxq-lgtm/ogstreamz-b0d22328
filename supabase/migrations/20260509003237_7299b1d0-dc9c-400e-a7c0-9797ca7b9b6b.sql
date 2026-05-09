CREATE TABLE public.boss_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.boss_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Boss reads own notes" ON public.boss_notes
  FOR SELECT TO authenticated
  USING (public.is_boss(auth.uid()) AND auth.uid() = user_id);

CREATE POLICY "Boss writes own notes" ON public.boss_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_boss(auth.uid()) AND auth.uid() = user_id);

CREATE POLICY "Boss updates own notes" ON public.boss_notes
  FOR UPDATE TO authenticated
  USING (public.is_boss(auth.uid()) AND auth.uid() = user_id)
  WITH CHECK (public.is_boss(auth.uid()) AND auth.uid() = user_id);

CREATE POLICY "Boss deletes own notes" ON public.boss_notes
  FOR DELETE TO authenticated
  USING (public.is_boss(auth.uid()) AND auth.uid() = user_id);

CREATE TRIGGER boss_notes_touch
BEFORE UPDATE ON public.boss_notes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_boss_notes_user_pinned_updated
  ON public.boss_notes (user_id, pinned DESC, updated_at DESC);