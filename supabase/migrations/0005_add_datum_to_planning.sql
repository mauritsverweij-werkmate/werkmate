alter table if exists planning
  add column if not exists datum date not null default current_date;
