-- Ensure at most one bedrijfsprofiel row per user (needed for safe upsert in onboarding)
ALTER TABLE bedrijfsprofiel ADD COLUMN IF NOT EXISTS id bigserial;
DO $$ BEGIN
  ALTER TABLE bedrijfsprofiel ADD CONSTRAINT bedrijfsprofiel_user_id_unique UNIQUE (user_id);
EXCEPTION WHEN duplicate_table THEN NULL;
          WHEN duplicate_object THEN NULL;
END $$;
