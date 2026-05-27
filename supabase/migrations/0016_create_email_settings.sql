CREATE TABLE IF NOT EXISTS email_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  auto_review_email boolean DEFAULT true,
  auto_reminder_email boolean DEFAULT true,
  reminder_days_before integer DEFAULT 3,
  auto_invoice_reminder boolean DEFAULT false,
  invoice_reminder_days integer DEFAULT 7,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_email_settings" ON email_settings
  FOR ALL USING (user_id = auth.uid());
