-- Add portal_token to offertes for client portal
ALTER TABLE offertes ADD COLUMN IF NOT EXISTS portal_token uuid DEFAULT gen_random_uuid() UNIQUE;
ALTER TABLE offertes ADD COLUMN IF NOT EXISTS handtekening text;

-- Allow public (anon) read of offertes by portal_token
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='offertes' AND policyname='Public read offerte by portal_token') THEN
    CREATE POLICY "Public read offerte by portal_token" ON offertes FOR SELECT TO anon USING (portal_token IS NOT NULL);
  END IF;
END $$;

-- Allow public read of bedrijfsprofiel for portal display
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bedrijfsprofiel' AND policyname='Public read bedrijfsprofiel for portal') THEN
    CREATE POLICY "Public read bedrijfsprofiel for portal" ON bedrijfsprofiel FOR SELECT TO anon USING (true);
  END IF;
END $$;
