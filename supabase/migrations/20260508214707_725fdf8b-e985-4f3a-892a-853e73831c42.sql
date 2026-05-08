
CREATE TABLE public.connect_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL,
  target_company TEXT NOT NULL,
  target_url TEXT,
  icp TEXT NOT NULL,
  offer TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  instantly_campaign_id TEXT,
  scout_summary TEXT,
  scout_news JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.connect_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage campaigns" ON public.connect_campaigns FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Owners view own campaigns" ON public.connect_campaigns FOR SELECT TO authenticated
  USING (auth.uid() = created_by);
CREATE TRIGGER touch_connect_campaigns BEFORE UPDATE ON public.connect_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.connect_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.connect_campaigns(id) ON DELETE CASCADE,
  full_name TEXT,
  job_title TEXT,
  email TEXT,
  linkedin_url TEXT,
  company TEXT,
  news_snippet TEXT,
  email_subject TEXT,
  email_body TEXT,
  send_status TEXT NOT NULL DEFAULT 'drafted',
  apollo_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_connect_leads_campaign ON public.connect_leads(campaign_id);
ALTER TABLE public.connect_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage leads" ON public.connect_leads FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER touch_connect_leads BEFORE UPDATE ON public.connect_leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.connect_sending_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  daily_cap INT NOT NULL DEFAULT 30,
  sent_today INT NOT NULL DEFAULT 0,
  last_reset DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.connect_sending_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage domains" ON public.connect_sending_domains FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER touch_connect_domains BEFORE UPDATE ON public.connect_sending_domains
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
