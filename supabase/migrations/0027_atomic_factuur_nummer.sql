-- Atomic per-user invoice number counter.
-- Replaces client-side nextNummer() which had a race condition when two
-- sessions saved simultaneously and both computed the same "next" number.

CREATE TABLE IF NOT EXISTS factuur_counters (
  user_id  uuid PRIMARY KEY,
  year     int  NOT NULL DEFAULT 0,
  counter  int  NOT NULL DEFAULT 0
);

-- Seed the counter from existing facturen so the function never produces
-- a duplicate for data that was created before this migration ran.
INSERT INTO factuur_counters (user_id, year, counter)
SELECT
  user_id,
  EXTRACT(YEAR FROM now())::int AS year,
  COALESCE(MAX(
    CASE
      WHEN nummer ~ ('^' || EXTRACT(YEAR FROM now())::int || '-[0-9]+$')
      THEN SPLIT_PART(nummer, '-', 2)::int
      ELSE 0
    END
  ), 0) AS counter
FROM facturen
WHERE user_id IS NOT NULL
GROUP BY user_id
ON CONFLICT (user_id) DO UPDATE
  SET counter = GREATEST(factuur_counters.counter, EXCLUDED.counter),
      year    = EXCLUDED.year;

-- The function is SECURITY DEFINER so it can write to factuur_counters
-- without exposing that table to direct client writes.
CREATE OR REPLACE FUNCTION next_factuur_nummer(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  yr      int := EXTRACT(YEAR FROM now())::int;
  new_cnt int;
BEGIN
  -- INSERT ON CONFLICT DO UPDATE is atomic at row level: two concurrent
  -- calls for the same user_id will serialize because PostgreSQL locks the
  -- counter row for the duration of the update.
  INSERT INTO factuur_counters (user_id, year, counter)
  VALUES (p_user_id, yr, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET year    = yr,
        counter = CASE
                    WHEN factuur_counters.year < yr THEN 1
                    ELSE factuur_counters.counter + 1
                  END
  RETURNING counter INTO new_cnt;

  RETURN yr::text || '-' || LPAD(new_cnt::text, 3, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION next_factuur_nummer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION next_factuur_nummer(uuid) TO service_role;
