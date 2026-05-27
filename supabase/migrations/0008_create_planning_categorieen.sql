create table if not exists planning_categorieen (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) not null,
  naam text not null,
  kleur text not null default '#6366F1',
  created_at timestamptz not null default now()
);
