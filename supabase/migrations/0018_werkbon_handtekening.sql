-- Digital signature on werkbonnen
ALTER TABLE werkbonnen ADD COLUMN IF NOT EXISTS handtekening text;
