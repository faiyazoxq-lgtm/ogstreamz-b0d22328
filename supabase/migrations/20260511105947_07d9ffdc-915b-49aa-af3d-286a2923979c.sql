-- 1. Add encrypted columns
ALTER TABLE public.bot_factory
  ADD COLUMN IF NOT EXISTS enc_telegram_bot_token bytea,
  ADD COLUMN IF NOT EXISTS enc_webhook_secret bytea;

-- 2. Migrate existing plaintext into encrypted columns
UPDATE public.bot_factory
   SET enc_telegram_bot_token = extensions.pgp_sym_encrypt(telegram_bot_token, public._stream_link_secret()),
       enc_webhook_secret     = extensions.pgp_sym_encrypt(webhook_secret,     public._stream_link_secret())
 WHERE enc_telegram_bot_token IS NULL
    OR enc_webhook_secret IS NULL;

-- 3. Drop plaintext columns
ALTER TABLE public.bot_factory
  DROP COLUMN IF EXISTS telegram_bot_token,
  DROP COLUMN IF EXISTS webhook_secret;

-- 4. Enforce NOT NULL
ALTER TABLE public.bot_factory
  ALTER COLUMN enc_telegram_bot_token SET NOT NULL,
  ALTER COLUMN enc_webhook_secret SET NOT NULL;

-- 5. Service-role-only RPC: insert a bot row, encrypt token, generate encrypted webhook secret
CREATE OR REPLACE FUNCTION public.bot_factory_create(
  p_pair_name text,
  p_pair_label text,
  p_token text,
  p_bot_username text,
  p_channel_chat_id text,
  p_bias text,
  p_asset_class text,
  p_created_by uuid
) RETURNS TABLE (id uuid, webhook_secret text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  k text := public._stream_link_secret();
  new_secret text := encode(gen_random_bytes(24), 'hex');
  new_id uuid;
BEGIN
  INSERT INTO public.bot_factory (
    pair_name, pair_label, enc_telegram_bot_token, bot_username,
    channel_chat_id, bias, asset_class, tier, created_by,
    enc_webhook_secret
  ) VALUES (
    p_pair_name,
    COALESCE(NULLIF(p_pair_label, ''), p_pair_name),
    pgp_sym_encrypt(p_token, k),
    NULLIF(p_bot_username, ''),
    NULLIF(p_channel_chat_id, ''),
    COALESCE(NULLIF(p_bias, ''), 'neutral'),
    NULLIF(p_asset_class, ''),
    'FREE',
    p_created_by,
    pgp_sym_encrypt(new_secret, k)
  ) RETURNING bot_factory.id INTO new_id;

  RETURN QUERY SELECT new_id, new_secret;
END $$;

-- 6. Reveal RPCs (plpgsql so extensions search_path resolves at run time)
CREATE OR REPLACE FUNCTION public.bot_factory_reveal_token(p_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v text;
BEGIN
  SELECT pgp_sym_decrypt(enc_telegram_bot_token, public._stream_link_secret())::text
    INTO v
    FROM public.bot_factory WHERE id = p_id;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.bot_factory_reveal_secret(p_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v text;
BEGIN
  SELECT pgp_sym_decrypt(enc_webhook_secret, public._stream_link_secret())::text
    INTO v
    FROM public.bot_factory WHERE id = p_id;
  RETURN v;
END $$;

-- 7. Lock down EXECUTE
REVOKE ALL ON FUNCTION public.bot_factory_create(text,text,text,text,text,text,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bot_factory_create(text,text,text,text,text,text,text,uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.bot_factory_reveal_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bot_factory_reveal_token(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.bot_factory_reveal_secret(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bot_factory_reveal_secret(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_factory_create(text,text,text,text,text,text,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bot_factory_reveal_token(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bot_factory_reveal_secret(uuid) TO service_role;