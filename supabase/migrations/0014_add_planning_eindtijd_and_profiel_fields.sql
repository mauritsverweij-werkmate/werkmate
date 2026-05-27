-- Add eindtijd to planning
alter table if exists planning
  add column if not exists eindtijd time;

-- Add extra bedrijfsprofiel fields
alter table if exists bedrijfsprofiel
  add column if not exists kvk_nummer text,
  add column if not exists btw_nummer text,
  add column if not exists website text,
  add column if not exists iban text;
