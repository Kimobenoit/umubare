CREATE TABLE debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(12) NOT NULL CHECK (type IN ('receivable','payable')),
  person VARCHAR(100) NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  due_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Pending','Partially Paid','Paid','Overdue')),
  base_status VARCHAR(20) NOT NULL DEFAULT 'Pending'
    CHECK (base_status IN ('Pending','Partially Paid','Paid','Overdue')),
  notes VARCHAR(200) NOT NULL DEFAULT '',
  paid_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_debts_user_id ON debts (user_id);
CREATE INDEX idx_debts_user_type ON debts (user_id, type);
