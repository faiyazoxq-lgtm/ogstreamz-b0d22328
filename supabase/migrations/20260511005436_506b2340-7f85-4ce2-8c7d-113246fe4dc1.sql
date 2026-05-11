CREATE OR REPLACE FUNCTION public.text_contains_denylisted_domain(_text text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE d record; needle text; hay text;
BEGIN
  IF _text IS NULL OR length(_text) = 0 THEN RETURN false; END IF;
  hay := lower(_text);
  FOR d IN SELECT domain FROM public.domain_denylist LOOP
    needle := lower(d.domain);
    IF needle = '' THEN CONTINUE; END IF;
    IF hay ~ ('(^|[^a-z0-9._-])' || regexp_replace(needle, '([.+*?(){}\[\]\\^$|])', '\\\1', 'g') || '($|[^a-z0-9])') THEN
      RETURN true;
    END IF;
  END LOOP;
  RETURN false;
END $fn$;

CREATE OR REPLACE FUNCTION public.reject_denylisted_domains()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE col text; val text;
BEGIN
  FOREACH col IN ARRAY TG_ARGV LOOP
    EXECUTE format('SELECT ($1).%I::text', col) INTO val USING NEW;
    IF val IS NOT NULL AND public.text_contains_denylisted_domain(val) THEN
      RAISE EXCEPTION 'Blocked domain detected in field %', col USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END $fn$;

DO $do$
DECLARE
  t_tbl text; t_cols text[]; existing text[]; c text; arglist text;
  pairs text[][] := ARRAY[
    ARRAY['portals','name,description,tagline,hero_url,logo_url'],
    ARRAY['bot_factory','webhook_url,description,name'],
    ARRAY['store_settings','stream_portal_url'],
    ARRAY['boss_chat_messages','content'],
    ARRAY['ai_logs','prompt,response'],
    ARRAY['connect_leads','notes,source,message'],
    ARRAY['portal_marketing','headline,body,cta_url'],
    ARRAY['custom_hubs','name,description,url'],
    ARRAY['boss_notes','content'],
    ARRAY['jokes','text,source'],
    ARRAY['battles','title,description'],
    ARRAY['connect_campaigns','name,description,target_url'],
    ARRAY['agent_api_keys','label,notes']
  ];
  i int;
BEGIN
  FOR i IN 1..array_length(pairs,1) LOOP
    t_tbl := pairs[i][1];
    t_cols := string_to_array(pairs[i][2], ',');
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t_tbl) THEN
      CONTINUE;
    END IF;
    existing := ARRAY[]::text[];
    FOREACH c IN ARRAY t_cols LOOP
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name=t_tbl AND column_name=c
          AND data_type IN ('text','character varying','character','citext')
      ) THEN
        existing := array_append(existing, c);
      END IF;
    END LOOP;
    IF array_length(existing,1) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS trg_denylist_block ON public.%I', t_tbl);
    arglist := array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(existing) x), ',');
    EXECUTE format(
      'CREATE TRIGGER trg_denylist_block BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.reject_denylisted_domains(%s)',
      t_tbl, arglist
    );
  END LOOP;
END $do$;