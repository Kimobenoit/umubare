CREATE TABLE debt_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  debt_id UUID REFERENCES debts(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  type_label VARCHAR(20) NOT NULL,
  person VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_debt_history_user ON debt_history (user_id, date DESC);
