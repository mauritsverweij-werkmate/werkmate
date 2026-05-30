CREATE TABLE IF NOT EXISTS email_templates (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null,
  subject text not null default '',
  body text not null default '',
  updated_at timestamptz default now(),
  CONSTRAINT email_templates_user_type_unique UNIQUE(user_id, type)
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their email templates"
  ON email_templates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
