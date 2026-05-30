ALTER TABLE werkbonnen ADD COLUMN IF NOT EXISTS fotos jsonb DEFAULT '[]'::jsonb;
