-- Create werkbonnen table for WerkMate
-- Run this SQL in Supabase SQL editor or via migration tooling.

create table if not exists werkbonnen (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) not null,
  klant text not null,
  datum date not null,
  omschrijving text,
  foto text,
  uren numeric,
  materialen text,
  status text not null default 'Nieuw',
  created_at timestamptz not null default now()
);
