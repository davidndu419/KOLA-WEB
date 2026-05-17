-- Optional: Create a secure RPC function for checking if an email exists.
-- This is more efficient than listing all users for large user bases.
-- Run this in the Supabase SQL Editor if you want the optimized path.
--
-- The API route /api/auth/check-email will try this RPC first,
-- then fall back to admin.listUsers if the function doesn't exist.

CREATE OR REPLACE FUNCTION check_email_exists_fn(email_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE email = lower(trim(email_input))
  );
END;
$$;

-- Only allow authenticated service role to call this function
REVOKE ALL ON FUNCTION check_email_exists_fn(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION check_email_exists_fn(TEXT) FROM anon;
REVOKE ALL ON FUNCTION check_email_exists_fn(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION check_email_exists_fn(TEXT) TO service_role;
