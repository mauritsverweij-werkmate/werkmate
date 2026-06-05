-- Fix 1: emails_log was created in 0013 without RLS; 0012's ALTER TABLE IF EXISTS
-- ran before the table existed and silently did nothing.
ALTER TABLE emails_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'emails_log' AND policyname = 'owner or team member'
  ) THEN
    CREATE POLICY "owner or team member" ON emails_log
      FOR ALL
      USING  (user_id = auth.uid() OR is_team_member_of(user_id))
      WITH CHECK (user_id = auth.uid() OR is_team_member_of(user_id));
  END IF;
END $$;

-- Fix 2: Remove all anon access to the bedrijfsprofiel base table.
-- Direct queries as anon would expose sensitive columns (iban, btw_nummer, etc.).
DROP POLICY IF EXISTS "Public read bedrijfsprofiel for portal" ON bedrijfsprofiel;

-- Create a restricted portal view with only the fields clients need to see.
-- security_invoker = off means the view runs as its owner (postgres), bypassing
-- RLS on the underlying tables — so anon can use the view without a base-table policy.
CREATE OR REPLACE VIEW bedrijfsprofiel_portal
  WITH (security_invoker = off)
AS
SELECT
  bp.user_id,
  bp.bedrijfsnaam,
  bp.logo,
  bp.adres,
  bp.email,
  bp.telefoon,
  bp.website
FROM bedrijfsprofiel bp
WHERE EXISTS (
  SELECT 1 FROM offertes o
  WHERE o.user_id = bp.user_id
    AND o.portal_token IS NOT NULL
);

-- Allow the anon role to query the view only (not the base table).
GRANT SELECT ON bedrijfsprofiel_portal TO anon;
