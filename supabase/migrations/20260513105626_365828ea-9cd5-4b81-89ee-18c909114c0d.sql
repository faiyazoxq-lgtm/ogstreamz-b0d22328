CREATE TABLE public.agent_key_presets_config (
  id smallint PRIMARY KEY DEFAULT 1,
  presets jsonb NOT NULL DEFAULT '[]'::jsonb,
  placeholder text NOT NULL DEFAULT '',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_key_presets_config_singleton CHECK (id = 1)
);

ALTER TABLE public.agent_key_presets_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Boss can view agent key presets config"
  ON public.agent_key_presets_config FOR SELECT
  USING (public.is_boss(auth.uid()));

CREATE POLICY "Boss can insert agent key presets config"
  ON public.agent_key_presets_config FOR INSERT
  WITH CHECK (public.is_boss(auth.uid()));

CREATE POLICY "Boss can update agent key presets config"
  ON public.agent_key_presets_config FOR UPDATE
  USING (public.is_boss(auth.uid()))
  WITH CHECK (public.is_boss(auth.uid()));

INSERT INTO public.agent_key_presets_config (id, presets, placeholder)
VALUES (1, '[]'::jsonb, '')
ON CONFLICT (id) DO NOTHING;