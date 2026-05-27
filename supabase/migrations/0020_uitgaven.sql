CREATE TABLE IF NOT EXISTS uitgaven (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  datum date NOT NULL,
  categorie text NOT NULL,
  omschrijving text NOT NULL,
  bedrag numeric NOT NULL DEFAULT 0,
  btw_percentage numeric NOT NULL DEFAULT 21,
  foto text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE uitgaven ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own uitgaven" ON uitgaven FOR ALL USING (auth.uid() = user_id);
