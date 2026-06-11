-- Remove test website written by Playwright e2e suite
UPDATE bedrijfsprofiel
SET website = NULL
WHERE website = 'https://playwright-test.nl';
