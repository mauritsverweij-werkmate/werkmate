CREATE TABLE IF NOT EXISTS emails_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  to_email text,
  subject text,
  type text,
  body text,
  status text default 'verzonden',
  sent_at timestamptz default now()
);
