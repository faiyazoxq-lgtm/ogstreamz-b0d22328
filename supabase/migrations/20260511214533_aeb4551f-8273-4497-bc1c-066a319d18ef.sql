-- Telegram inbox: one row per incoming Telegram update (message)
CREATE TABLE IF NOT EXISTS public.telegram_messages (
  update_id    bigint PRIMARY KEY,
  chat_id      bigint NOT NULL,
  chat_type    text,
  chat_title   text,
  from_user_id bigint,
  from_username text,
  from_name    text,
  text         text,
  raw          jsonb NOT NULL,
  message_date timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_messages_chat_date
  ON public.telegram_messages (chat_id, message_date DESC);

CREATE INDEX IF NOT EXISTS idx_telegram_messages_date
  ON public.telegram_messages (message_date DESC);

ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;

-- Admin-only read; the webhook writes via service role and bypasses RLS.
DROP POLICY IF EXISTS "Admins can view telegram messages" ON public.telegram_messages;
CREATE POLICY "Admins can view telegram messages"
  ON public.telegram_messages
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
