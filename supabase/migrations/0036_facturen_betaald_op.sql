-- Add betaald_op date to track when a factuur was actually paid
ALTER TABLE facturen ADD COLUMN IF NOT EXISTS betaald_op date;

-- Backfill existing betaald facturen with today's date.
-- We use CURRENT_DATE because we have no reliable payment date in existing data.
-- Going forward, updateStatus() in the app will set the correct date.
UPDATE facturen
SET betaald_op = CURRENT_DATE
WHERE status = 'Betaald'
  AND betaald_op IS NULL;
