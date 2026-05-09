
CREATE TABLE IF NOT EXISTS public.battles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  scenario text NOT NULL,
  language text NOT NULL DEFAULT 'medium',
  themes text[] NOT NULL DEFAULT '{}'::text[],
  custom_prompt text NOT NULL DEFAULT '',
  accent text NOT NULL DEFAULT '#ff2e55',
  emoji text NOT NULL DEFAULT '💀',
  tagline text NOT NULL DEFAULT 'EVERY CHOICE IS A LOSS',
  research jsonb NOT NULL DEFAULT '{}'::jsonb,
  theme_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  public boolean NOT NULL DEFAULT true,
  view_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_battles_created_at ON public.battles (created_at DESC);

ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read battles"
  ON public.battles FOR SELECT TO public
  USING (public = true OR is_boss(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Boss manages battles"
  ON public.battles FOR ALL TO authenticated
  USING (is_boss(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (is_boss(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.battle_plays (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  battle_id uuid NOT NULL REFERENCES public.battles(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  round integer NOT NULL DEFAULT 1,
  situation text NOT NULL,
  choices jsonb NOT NULL DEFAULT '[]'::jsonb,
  picked_index integer,
  outcome text,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_battle_plays_battle ON public.battle_plays (battle_id, created_at DESC);

ALTER TABLE public.battle_plays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone insert battle plays"
  ON public.battle_plays FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Boss reads all plays"
  ON public.battle_plays FOR SELECT TO authenticated
  USING (is_boss(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
