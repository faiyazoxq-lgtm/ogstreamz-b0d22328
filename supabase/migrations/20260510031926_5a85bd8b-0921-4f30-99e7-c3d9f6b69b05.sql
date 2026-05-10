ALTER TABLE public.portals
  ADD COLUMN IF NOT EXISTS music_hooks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS trade_briefs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS connect_openers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tool_ideas jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.portals SET music_hooks = jokes
 WHERE kind = 'music' AND jsonb_typeof(jokes) = 'array'
   AND jsonb_array_length(jokes) > 0 AND jsonb_array_length(music_hooks) = 0;

UPDATE public.portals SET trade_briefs = jokes
 WHERE kind = 'trade' AND jsonb_typeof(jokes) = 'array'
   AND jsonb_array_length(jokes) > 0 AND jsonb_array_length(trade_briefs) = 0;

UPDATE public.portals SET connect_openers = jokes
 WHERE kind = 'connect' AND jsonb_typeof(jokes) = 'array'
   AND jsonb_array_length(jokes) > 0 AND jsonb_array_length(connect_openers) = 0;

UPDATE public.portals SET tool_ideas = jokes
 WHERE kind = 'tools' AND jsonb_typeof(jokes) = 'array'
   AND jsonb_array_length(jokes) > 0 AND jsonb_array_length(tool_ideas) = 0;