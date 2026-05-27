alter table if exists offertes
  add column if not exists regels jsonb default '[]'::jsonb,
  add column if not exists subtotaal numeric default 0,
  add column if not exists btw numeric default 0,
  add column if not exists totaal numeric default 0;
