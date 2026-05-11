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
    COALESCE(p_channel_chat_id, ''),
    COALESCE(NULLIF(p_bias, ''), 'neutral'),
    NULLIF(p_asset_class, ''),
    'FREE',
    p_created_by,
    pgp_sym_encrypt(new_secret, k)
  ) RETURNING bot_factory.id INTO new_id;

  RETURN QUERY SELECT new_id, new_secret;
END $$;

REVOKE ALL ON FUNCTION public.bot_factory_create(text,text,text,text,text,text,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bot_factory_create(text,text,text,text,text,text,text,uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_factory_create(text,text,text,text,text,text,text,uuid) TO service_role;

-- Cleanup: remove e2e verification rows
DELETE FROM public.bot_factory WHERE pair_name LIKE 'e2e-verify-%';