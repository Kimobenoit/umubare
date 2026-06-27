CREATE TABLE records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description VARCHAR(100) NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  category VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'RWF' CHECK (currency IN ('RWF','USD','EUR')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_records_user_id ON records (user_id);
CREATE INDEX idx_records_user_date ON records (user_id, date DESC);
