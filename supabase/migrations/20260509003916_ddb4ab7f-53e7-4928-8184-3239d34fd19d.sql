
CREATE TABLE IF NOT EXISTS public.hub_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  style_prompt text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT 'google/gemini-2.5-flash',
  integrations jsonb NOT NULL DEFAULT '{}'::jsonb,
  tuning jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hub_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hub settings readable by authenticated"
  ON public.hub_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Boss/admin can insert hub settings"
  ON public.hub_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Boss/admin can update hub settings"
  ON public.hub_settings FOR UPDATE
  TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Boss/admin can delete hub settings"
  ON public.hub_settings FOR DELETE
  TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER hub_settings_touch
  BEFORE UPDATE ON public.hub_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.hub_settings (hub_key, display_name, style_prompt, model, integrations, tuning) VALUES
  ('music',   'MusicHUB',   'Cinematic, gritty, neon-noir lyrics with a syndicate underground swagger. Tight hooks, vivid imagery.', 'google/gemini-2.5-flash',
    '{"suno": {"enabled": true}}'::jsonb,
    '{"temperature": 0.9, "max_tokens": 800, "default_genre": "trap-noir"}'::jsonb),
  ('jokes',   'JokesHUB',   'Sharp, observational, late-night standup energy. Punch up, never down. Keep it under 3 sentences.', 'google/gemini-2.5-flash',
    '{}'::jsonb,
    '{"temperature": 1.1, "max_tokens": 300}'::jsonb),
  ('trade',   'TradeHUB',   'Concise quant analyst voice. Lead with bias, then 2-3 catalysts, then risk. No emojis.', 'google/gemini-2.5-pro',
    '{"perplexity": {"enabled": true}}'::jsonb,
    '{"temperature": 0.3, "max_tokens": 600, "default_pair": "XAU/USD"}'::jsonb),
  ('tools',   'ToolHUB',    'Pragmatic engineer voice. Explain inputs, outputs, formulas in plain language.', 'google/gemini-2.5-flash',
    '{}'::jsonb,
    '{"temperature": 0.4, "max_tokens": 500}'::jsonb),
  ('news',    'NewsHUB',    'Wire-service neutrality with a syndicate edge. Headline + 2-line dek + 3 bullet takeaways.', 'google/gemini-2.5-flash',
    '{"firecrawl": {"enabled": true}, "perplexity": {"enabled": true}}'::jsonb,
    '{"temperature": 0.5, "max_tokens": 700}'::jsonb),
  ('connect', 'ConnectHUB', 'Cold outreach copy: 1 line hook, 1 line proof, 1 line CTA. Sharp, no fluff.', 'google/gemini-2.5-flash',
    '{"apollo": {"enabled": true}, "instantly": {"enabled": true}, "firecrawl": {"enabled": true}}'::jsonb,
    '{"temperature": 0.7, "max_tokens": 400}'::jsonb)
ON CONFLICT (hub_key) DO NOTHING;
