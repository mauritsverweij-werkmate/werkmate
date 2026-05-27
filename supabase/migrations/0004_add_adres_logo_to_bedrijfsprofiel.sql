ALTER TABLE bedrijfsprofiel
  ADD COLUMN IF NOT EXISTS adres text,
  ADD COLUMN IF NOT EXISTS logo text;
