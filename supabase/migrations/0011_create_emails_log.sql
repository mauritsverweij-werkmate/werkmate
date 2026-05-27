create table if not exists emails_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) not null,
  to_email text not null,
  subject text not null,
  type text not null, -- offerte | factuur | herinnering | review | team
  body text default '',
  status text not null default 'verzonden', -- verzonden | mislukt
  sent_at timestamptz not null default now()
);

create index if not exists emails_log_user_id_idx on emails_log(user_id);
create index if not exists emails_log_sent_at_idx  on emails_log(sent_at desc);
