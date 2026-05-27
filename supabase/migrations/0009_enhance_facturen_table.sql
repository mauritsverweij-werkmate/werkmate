-- Enhance facturen table for full invoice functionality
alter table if exists facturen
  add column if not exists nummer text,
  add column if not exists klant_email text,
  add column if not exists vervaldatum date,
  add column if not exists regels jsonb default '[]'::jsonb,
  add column if not exists btw numeric default 0,
  add column if not exists totaal numeric default 0;
