-- Repair validate_mcp_api_token after 20260909140000 set search_path=public.
-- pgcrypto.digest is in the extensions schema; without it the RPC 42883s and
-- professor PATs look revoked.

CREATE OR REPLACE FUNCTION public.validate_mcp_api_token(token_input text)
RETURNS TABLE (
  user_id uuid,
  email text,
  user_role text,
  token_id bigint,
  course_ids integer[],
  token_role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  token_hash_input text;
BEGIN
  token_hash_input := encode(digest(convert_to(token_input, 'UTF8'), 'sha256'), 'hex');

  RETURN QUERY
  SELECT
    t.user_id,
    u.email::text,
    tu.role::text,
    t.id,
    t.course_ids,
    t.token_role
  FROM public.mcp_api_tokens t
  JOIN auth.users u ON u.id = t.user_id
  JOIN public.tenant_users tu ON tu.user_id = t.user_id AND tu.status = 'active'
  WHERE t.token_hash = token_hash_input
    AND t.is_active = true
    AND (t.expires_at IS NULL OR t.expires_at > now())
    AND tu.role IN ('teacher', 'admin')
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_mcp_api_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_mcp_api_token(text) TO service_role;
