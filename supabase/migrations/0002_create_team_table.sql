-- Create team table for WerkMate
-- Run this SQL in Supabase SQL editor or via migration tooling.

create table if not exists team (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) not null,
  email text not null,
  role text not null,
  invited_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
