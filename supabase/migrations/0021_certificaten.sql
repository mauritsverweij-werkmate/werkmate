CREATE TABLE IF NOT EXISTS certificaten (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  naam text NOT NULL,
  type text NOT NULL,
  vervaldatum date,
  notitie text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE certificaten ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own certificaten" ON certificaten FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
