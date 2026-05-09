ALTER TABLE public.portals ALTER COLUMN swear_chat_enabled SET DEFAULT true;
ALTER TABLE public.battles ALTER COLUMN swear_chat_enabled SET DEFAULT true;
ALTER TABLE public.custom_hubs ALTER COLUMN swear_chat_enabled SET DEFAULT true;

UPDATE public.portals SET swear_chat_enabled = true WHERE swear_chat_enabled = false;
UPDATE public.battles SET swear_chat_enabled = true WHERE swear_chat_enabled = false;
UPDATE public.custom_hubs SET swear_chat_enabled = true WHERE swear_chat_enabled = false;