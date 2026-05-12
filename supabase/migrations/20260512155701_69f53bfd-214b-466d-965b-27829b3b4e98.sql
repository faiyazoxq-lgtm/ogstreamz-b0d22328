
-- 1. Extend alert category enum
DO $$ BEGIN
  ALTER TYPE public.system_alert_category ADD VALUE IF NOT EXISTS 'security';
EXCEPTION WHEN others THEN NULL; END $$;

-- 2. security_events table
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn','error')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON public.security_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON public.security_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events (event_type, created_at DESC);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Boss read security events" ON public.security_events;
CREATE POLICY "Boss read security events" ON public.security_events
FOR SELECT TO authenticated
USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(),'admin'::app_role));

-- No INSERT/UPDATE/DELETE policies → only service-role server code can write.

-- 3. known_devices table
CREATE TABLE IF NOT EXISTS public.known_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_hash text NOT NULL,
  user_agent text,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_hash)
);
CREATE INDEX IF NOT EXISTS idx_known_devices_user ON public.known_devices (user_id, last_seen DESC);

ALTER TABLE public.known_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own devices" ON public.known_devices;
CREATE POLICY "Users read own devices" ON public.known_devices
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_boss(auth.uid()) OR public.has_role(auth.uid(),'admin'::app_role));
-- Only service-role inserts/updates.

-- 4. Trigger helper: emit security event + system_alert
CREATE OR REPLACE FUNCTION public._emit_security_alert(
  _event_type text,
  _severity text,
  _user_id uuid,
  _actor_id uuid,
  _title text,
  _message text,
  _metadata jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.security_events (event_type, severity, user_id, actor_id, metadata)
    VALUES (_event_type, _severity, _user_id, _actor_id, COALESCE(_metadata,'{}'::jsonb));
  INSERT INTO public.system_alerts (category, severity, source, title, message, metadata)
    VALUES (
      'security'::system_alert_category,
      (CASE WHEN _severity IN ('info','warn','error') THEN _severity ELSE 'warn' END)::system_alert_severity,
      'security-monitor',
      _title,
      _message,
      COALESCE(_metadata,'{}'::jsonb)
    );
END;
$$;

-- 5. Trigger on user_roles
CREATE OR REPLACE FUNCTION public._trg_user_roles_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid := auth.uid();
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM public._emit_security_alert(
      'role_granted',
      CASE WHEN NEW.role::text = 'admin' THEN 'error' ELSE 'warn' END,
      NEW.user_id, actor,
      'Role granted: ' || NEW.role::text,
      'A ' || NEW.role::text || ' role was added to a user account.',
      jsonb_build_object('role', NEW.role, 'user_id', NEW.user_id, 'actor_id', actor)
    );
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM public._emit_security_alert(
      'role_revoked', 'warn',
      OLD.user_id, actor,
      'Role revoked: ' || OLD.role::text,
      'A ' || OLD.role::text || ' role was removed from a user account.',
      jsonb_build_object('role', OLD.role, 'user_id', OLD.user_id, 'actor_id', actor)
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_user_roles_audit ON public.user_roles;
CREATE TRIGGER trg_user_roles_audit
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public._trg_user_roles_audit();

-- 6. Trigger on profiles for rank/banned changes
CREATE OR REPLACE FUNCTION public._trg_profiles_security_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid := auth.uid();
BEGIN
  IF NEW.rank IS DISTINCT FROM OLD.rank THEN
    PERFORM public._emit_security_alert(
      'rank_changed',
      CASE WHEN NEW.rank::text IN ('boss','vip') THEN 'error' ELSE 'warn' END,
      NEW.id, actor,
      'Rank changed: ' || OLD.rank::text || ' → ' || NEW.rank::text,
      'User rank was modified.',
      jsonb_build_object('from', OLD.rank, 'to', NEW.rank, 'user_id', NEW.id, 'actor_id', actor)
    );
  END IF;
  IF NEW.banned IS DISTINCT FROM OLD.banned THEN
    PERFORM public._emit_security_alert(
      CASE WHEN NEW.banned THEN 'user_banned' ELSE 'user_unbanned' END,
      'warn',
      NEW.id, actor,
      CASE WHEN NEW.banned THEN 'User banned' ELSE 'User unbanned' END,
      COALESCE(NEW.banned_reason, ''),
      jsonb_build_object('user_id', NEW.id, 'actor_id', actor, 'reason', NEW.banned_reason)
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profiles_security_audit ON public.profiles;
CREATE TRIGGER trg_profiles_security_audit
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public._trg_profiles_security_audit();
