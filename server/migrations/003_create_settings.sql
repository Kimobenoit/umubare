CREATE TABLE settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  usd_rate NUMERIC(10,2) NOT NULL DEFAULT 1300,
  eur_rate NUMERIC(10,2) NOT NULL DEFAULT 1450,
  cap NUMERIC(12,2) NOT NULL DEFAULT 0,
  theme VARCHAR(10) NOT NULL DEFAULT 'light' CHECK (theme IN ('light','dark')),
  default_currency VARCHAR(3) NOT NULL DEFAULT 'RWF' CHECK (default_currency IN ('RWF','USD','EUR')),
  display_currency VARCHAR(3) NOT NULL DEFAULT 'RWF' CHECK (display_currency IN ('RWF','USD','EUR')),
  show_weekly_chart BOOLEAN NOT NULL DEFAULT true,
  compact_table BOOLEAN NOT NULL DEFAULT false,
  confirm_before_delete BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
