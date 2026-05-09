ALTER TABLE public.portals ADD COLUMN IF NOT EXISTS swear_chat_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.battles ADD COLUMN IF NOT EXISTS swear_chat_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.custom_hubs ADD COLUMN IF NOT EXISTS swear_chat_enabled boolean NOT NULL DEFAULT false;