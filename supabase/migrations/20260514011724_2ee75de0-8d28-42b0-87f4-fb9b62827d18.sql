-- OG Bot persistent per-user memory (facts the bot has learned about the user)
CREATE TABLE public.og_bot_memory (
  user_id UUID NOT NULL PRIMARY KEY,
  facts JSONB NOT NULL DEFAULT '[]'::jsonb,
  message_count INTEGER NOT NULL DEFAULT 0,
  last_probe_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.og_bot_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own og bot memory"
  ON public.og_bot_memory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own og bot memory"
  ON public.og_bot_memory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own og bot memory"
  ON public.og_bot_memory FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own og bot memory"
  ON public.og_bot_memory FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_og_bot_memory_updated_at
  BEFORE UPDATE ON public.og_bot_memory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();