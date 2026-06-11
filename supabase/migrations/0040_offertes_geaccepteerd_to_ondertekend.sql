-- Rename 'Geaccepteerd' to 'Ondertekend' — single canonical signed status
UPDATE offertes
SET status = 'Ondertekend'
WHERE status = 'Geaccepteerd';
