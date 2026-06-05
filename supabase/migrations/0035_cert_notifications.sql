CREATE TABLE IF NOT EXISTS cert_notifications (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cert_id     uuid        NOT NULL,
  cert_naam   text        NOT NULL,
  sent_at     date        NOT NULL DEFAULT CURRENT_DATE,
  days_left   integer     NOT NULL,
  UNIQUE (user_id, cert_id, sent_at)
);

ALTER TABLE cert_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cert_notifications"
  ON cert_notifications FOR ALL
  USING (auth.uid() = user_id);
