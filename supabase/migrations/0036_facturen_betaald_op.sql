-- Add betaald_op date to track when a factuur was actually paid
ALTER TABLE facturen ADD COLUMN IF NOT EXISTS betaald_op date;

-- Backfill existing betaald facturen: use datum as fallback
UPDATE facturen
SET betaald_op = datum::date
WHERE status = 'Betaald'
  AND betaald_op IS NULL
  AND datum IS NOT NULL;
