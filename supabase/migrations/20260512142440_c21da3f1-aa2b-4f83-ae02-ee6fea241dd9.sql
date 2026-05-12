
CREATE TABLE public.letter_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled letter',
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  letter TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_letter_history_user_created ON public.letter_history(user_id, created_at DESC);

ALTER TABLE public.letter_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own letter history"
ON public.letter_history FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own letter history"
ON public.letter_history FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own letter history"
ON public.letter_history FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own letter history"
ON public.letter_history FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all letter history"
ON public.letter_history FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_boss(auth.uid()));

CREATE TRIGGER trg_letter_history_updated
BEFORE UPDATE ON public.letter_history
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
