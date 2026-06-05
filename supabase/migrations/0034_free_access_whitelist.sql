CREATE TABLE IF NOT EXISTS free_access_whitelist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  note text,
  created_at timestamptz DEFAULT now()
);

-- No RLS — only accessible via service role key from edge functions / admin
-- The app checks this server-side via the anon key with a specific query
ALTER TABLE free_access_whitelist ENABLE ROW LEVEL SECURITY;

-- Allow read-only access to authenticated users (to check their own email)
CREATE POLICY "Users can check own free access"
  ON free_access_whitelist FOR SELECT
  USING (email = auth.email());
