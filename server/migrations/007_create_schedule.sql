CREATE TABLE schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  type VARCHAR(10) NOT NULL DEFAULT 'work' CHECK (type IN ('work','payment','date')),
  due_date DATE NOT NULL,
  reminder_date DATE,
  priority VARCHAR(10) NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High','Medium','Low')),
  status VARCHAR(20) NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Pending','In Progress','Completed','Overdue')),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  notes VARCHAR(200) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_schedule_user_id ON schedule (user_id);
CREATE INDEX idx_schedule_user_due ON schedule (user_id, due_date);
