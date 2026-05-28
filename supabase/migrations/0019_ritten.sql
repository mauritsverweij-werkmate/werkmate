CREATE TABLE IF NOT EXISTS ritten (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  datum date NOT NULL,
  vertrek text NOT NULL,
  bestemming text NOT NULL,
  km numeric NOT NULL DEFAULT 0,
  doel text NOT NULL DEFAULT 'zakelijk',
  klant text,
  bedrag numeric GENERATED ALWAYS AS (km * 0.23) STORED,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ritten ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own ritten" ON ritten FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
