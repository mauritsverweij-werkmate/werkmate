alter table if exists planning
  add column if not exists categorie text,
  add column if not exists medewerker text;
