CREATE TABLE IF NOT EXISTS prijslijst_items (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) not null,
  dienst text not null,
  eenheid text not null default 'uur',
  prijs numeric not null default 0,
  categorie text not null default 'Overig',
  created_at timestamptz not null default now()
);

alter table prijslijst_items enable row level security;

create policy "owner or team member" on prijslijst_items
  for all
  using  (user_id = auth.uid() or is_team_member_of(user_id))
  with check (user_id = auth.uid() or is_team_member_of(user_id));
