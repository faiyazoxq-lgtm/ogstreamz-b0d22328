CREATE TABLE public.boss_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'web',
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  persona text,
  market_context jsonb DEFAULT '{}'::jsonb,
  external_user text,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.boss_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Boss can view boss chat" ON public.boss_chat_messages
  FOR SELECT USING (public.is_boss(auth.uid()));

CREATE POLICY "Boss can update boss chat" ON public.boss_chat_messages
  FOR UPDATE USING (public.is_boss(auth.uid()));

CREATE POLICY "Boss can delete boss chat" ON public.boss_chat_messages
  FOR DELETE USING (public.is_boss(auth.uid()));

CREATE POLICY "Anyone authenticated can insert boss chat" ON public.boss_chat_messages
  FOR INSERT WITH CHECK (true);

CREATE INDEX idx_boss_chat_messages_created_at ON public.boss_chat_messages (created_at DESC);
CREATE INDEX idx_boss_chat_messages_source ON public.boss_chat_messages (source);
CREATE INDEX idx_boss_chat_messages_session ON public.boss_chat_messages (session_id);