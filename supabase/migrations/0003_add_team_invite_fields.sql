-- Add invite and shared org fields to the team table for WerkMate
-- Run this SQL in Supabase SQL editor or via migration tooling.

alter table if exists team
  add column if not exists invite_token text unique;

alter table if exists team
  add column if not exists accepted_user_id uuid references auth.users(id);

alter table if exists team
  add column if not exists accepted_at timestamptz;
