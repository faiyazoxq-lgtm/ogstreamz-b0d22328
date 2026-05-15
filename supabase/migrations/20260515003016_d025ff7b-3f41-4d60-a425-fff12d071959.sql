INSERT INTO public.hub_settings (hub_key, display_name, enabled, tuning)
VALUES ('og-bot', 'OG Bot', true, '{"mode": "og"}'::jsonb)
ON CONFLICT (hub_key) DO NOTHING;