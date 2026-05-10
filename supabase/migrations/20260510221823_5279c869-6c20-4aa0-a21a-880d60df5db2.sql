ALTER TABLE public.portals ADD COLUMN IF NOT EXISTS paid_services jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.custom_hubs ADD COLUMN IF NOT EXISTS paid_services jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_portals_paid_services ON public.portals USING gin (paid_services);
CREATE INDEX IF NOT EXISTS idx_custom_hubs_paid_services ON public.custom_hubs USING gin (paid_services);