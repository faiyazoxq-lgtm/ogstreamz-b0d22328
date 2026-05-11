CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE IF NOT EXISTS public.boss_todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  details text,
  category text NOT NULL DEFAULT 'ops',
  priority text NOT NULL DEFAULT 'P2',
  status text NOT NULL DEFAULT 'todo',
  link text,
  position int NOT NULL DEFAULT 0,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT boss_todos_priority_chk CHECK (priority IN ('P0','P1','P2','P3')),
  CONSTRAINT boss_todos_status_chk CHECK (status IN ('todo','in_progress','blocked','done')),
  CONSTRAINT boss_todos_category_chk CHECK (category IN ('security','performance','ux','seo','ops','content'))
);

ALTER TABLE public.boss_todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boss_todos admin read"   ON public.boss_todos FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "boss_todos admin insert" ON public.boss_todos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "boss_todos admin update" ON public.boss_todos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "boss_todos admin delete" ON public.boss_todos FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS trg_boss_todos_updated ON public.boss_todos;
CREATE TRIGGER trg_boss_todos_updated BEFORE UPDATE ON public.boss_todos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.boss_todos;

INSERT INTO public.boss_todos (title, details, category, priority, status, link, position) VALUES
  ('Wire Cloudflare Web Analytics token', 'Paste the site token from Cloudflare → Web Analytics into the setup page. Without it the beacon does not record anything.', 'ops', 'P0', 'todo', '/boss/analytics-setup', 10),
  ('Run Denylist Audit & clean any DB hits', 'Open the audit page, click Run audit, and clean any rows it surfaces under the db source.', 'security', 'P0', 'todo', '/boss/denylist-audit', 20),
  ('Sweep codebase to use SafeLink / SafeEmbed / SafeImage', 'Replace raw <a href>, <iframe src>, <img src> for any field that holds external or member-supplied URLs with the safe components from src/components/SafeLink.tsx.', 'security', 'P0', 'todo', NULL, 30),
  ('Add Cloudflare DNS + caching rules', 'Follow the earlier guide: proxied CNAMEs, Edge TTL 1 month for /assets/ and image extensions, Brotli + Early Hints + HTTP/3 on, Rocket Loader off.', 'performance', 'P0', 'todo', NULL, 40),
  ('Lighthouse pass on key public routes', 'Routes: /, /music, /jokes, /tools, /vip. Fix LCP image (preload + fetchpriority="high"), defer non-critical JS, loading="lazy" on below-fold images.', 'performance', 'P1', 'todo', NULL, 50),
  ('SEO: per-route head() with unique title/description/og:image', 'Verify every public route has its own metadata, single H1, canonical tag.', 'seo', 'P1', 'todo', NULL, 60),
  ('Accessibility pass', 'Keyboard focus rings on all interactive elements, aria-label on icon-only buttons, color-contrast pass on tinted tiles.', 'ux', 'P1', 'todo', NULL, 70),
  ('Error boundaries on every route with a loader', 'Confirm errorComponent + notFoundComponent are set on every loader route; root has notFoundComponent.', 'ux', 'P1', 'todo', NULL, 80),
  ('Email verification flow review end-to-end', 'Walk signup → confirm → first login on a clean account; check bounce handling and auth email branding.', 'ops', 'P1', 'todo', NULL, 90),
  ('Extend Publish Check to runtime probes', 'Probe analytics beacon, denylist hits, sitemap, robots.txt, and every /api/public/* endpoint.', 'ops', 'P2', 'todo', '/boss/publish-check', 100),
  ('Realtime presence in boss portal', 'Show who else is editing inside the boss portal using a Supabase realtime presence channel.', 'ops', 'P2', 'todo', NULL, 110),
  ('Nightly backup export of key tables', 'Snapshot critical tables to a private storage bucket on a schedule.', 'ops', 'P2', 'todo', NULL, 120),
  ('AI Gateway spend dashboard', 'Surface per-model spend in /boss/portal-costs.', 'ops', 'P2', 'todo', '/boss/portal-costs', 130),
  ('Dark/light auto-switch with system preference', 'Respect prefers-color-scheme and add a manual override.', 'ux', 'P3', 'todo', NULL, 140),
  ('Custom 404 illustration', 'Replace the default not-found component with branded artwork.', 'content', 'P3', 'todo', NULL, 150),
  ('Boss audit log', 'Persist who changed what, when, across boss portal mutations.', 'security', 'P3', 'todo', NULL, 160);