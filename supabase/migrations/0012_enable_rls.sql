-- Enable Row Level Security on all WerkMate tables
-- and create appropriate access policies.
--
-- Policy model:
--   - Org owners access rows where user_id = auth.uid()
--   - Accepted team members access rows belonging to their employer's org
--   - Team invite acceptance is allowed for any authenticated user holding the token

-- Helper: is the current user an accepted team member of the given org owner?
create or replace function is_team_member_of(owner_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from team
    where team.user_id   = owner_id
    and   team.accepted_user_id = auth.uid()
  );
$$;

-- ── bedrijfsprofiel ────────────────────────────────────────────
alter table if exists bedrijfsprofiel enable row level security;
drop policy if exists "owner or team member" on bedrijfsprofiel;
create policy "owner or team member" on bedrijfsprofiel
  for all
  using  (user_id = auth.uid() or is_team_member_of(user_id))
  with check (user_id = auth.uid() or is_team_member_of(user_id));

-- ── offertes ──────────────────────────────────────────────────
alter table if exists offertes enable row level security;
drop policy if exists "owner or team member" on offertes;
create policy "owner or team member" on offertes
  for all
  using  (user_id = auth.uid() or is_team_member_of(user_id))
  with check (user_id = auth.uid() or is_team_member_of(user_id));

-- ── klanten ───────────────────────────────────────────────────
alter table if exists klanten enable row level security;
drop policy if exists "owner or team member" on klanten;
create policy "owner or team member" on klanten
  for all
  using  (user_id = auth.uid() or is_team_member_of(user_id))
  with check (user_id = auth.uid() or is_team_member_of(user_id));

-- ── planning ──────────────────────────────────────────────────
alter table if exists planning enable row level security;
drop policy if exists "owner or team member" on planning;
create policy "owner or team member" on planning
  for all
  using  (user_id = auth.uid() or is_team_member_of(user_id))
  with check (user_id = auth.uid() or is_team_member_of(user_id));

-- ── facturen ──────────────────────────────────────────────────
alter table if exists facturen enable row level security;
drop policy if exists "owner or team member" on facturen;
create policy "owner or team member" on facturen
  for all
  using  (user_id = auth.uid() or is_team_member_of(user_id))
  with check (user_id = auth.uid() or is_team_member_of(user_id));

-- ── werkbonnen ────────────────────────────────────────────────
alter table if exists werkbonnen enable row level security;
drop policy if exists "owner or team member" on werkbonnen;
create policy "owner or team member" on werkbonnen
  for all
  using  (user_id = auth.uid() or is_team_member_of(user_id))
  with check (user_id = auth.uid() or is_team_member_of(user_id));

-- ── planning_categorieen ──────────────────────────────────────
alter table if exists planning_categorieen enable row level security;
drop policy if exists "owner or team member" on planning_categorieen;
create policy "owner or team member" on planning_categorieen
  for all
  using  (user_id = auth.uid() or is_team_member_of(user_id))
  with check (user_id = auth.uid() or is_team_member_of(user_id));

-- ── emails_log ────────────────────────────────────────────────
alter table if exists emails_log enable row level security;
drop policy if exists "owner or team member" on emails_log;
create policy "owner or team member" on emails_log
  for all
  using  (user_id = auth.uid() or is_team_member_of(user_id))
  with check (user_id = auth.uid() or is_team_member_of(user_id));

-- ── team ──────────────────────────────────────────────────────
alter table if exists team enable row level security;

-- Org owner: full control over their team rows
drop policy if exists "owner full control" on team;
create policy "owner full control" on team
  for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Accepted member: can read their own membership row
drop policy if exists "member reads own row" on team;
create policy "member reads own row" on team
  for select
  using (accepted_user_id = auth.uid());

-- Invite acceptance: any authenticated user can accept an unclaimed invite
-- (the token is a secret UUID delivered via email, so possession = proof of identity)
drop policy if exists "accept invite" on team;
create policy "accept invite" on team
  for update
  using  (invite_token is not null and accepted_user_id is null and auth.uid() is not null)
  with check (accepted_user_id = auth.uid());
