CREATE TABLE IF NOT EXISTS public.boss_action_favourites (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  action_keys TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.boss_action_favourites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Boss reads own favourites"
ON public.boss_action_favourites
FOR SELECT
TO authenticated
USING (user_id = auth.uid() AND public.is_boss(auth.uid()));

CREATE POLICY "Boss inserts own favourites"
ON public.boss_action_favourites
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_boss(auth.uid()));

CREATE POLICY "Boss updates own favourites"
ON public.boss_action_favourites
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND public.is_boss(auth.uid()))
WITH CHECK (user_id = auth.uid() AND public.is_boss(auth.uid()));

CREATE POLICY "Boss deletes own favourites"
ON public.boss_action_favourites
FOR DELETE
TO authenticated
USING (user_id = auth.uid() AND public.is_boss(auth.uid()));