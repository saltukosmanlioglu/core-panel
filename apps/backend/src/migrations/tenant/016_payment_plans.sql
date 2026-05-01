CREATE TABLE IF NOT EXISTS "{{schema}}".payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_owner_id UUID NOT NULL
    REFERENCES "{{schema}}".property_owners(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  title VARCHAR(255),
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  remaining_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "{{schema}}".payment_plan_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL
    REFERENCES "{{schema}}".payment_plans(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  paid_date DATE,
  status VARCHAR(50) DEFAULT 'pending',
  receipt_path TEXT,
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_plans_property_owner_id ON "{{schema}}".payment_plans(property_owner_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_project_id ON "{{schema}}".payment_plans(project_id);
CREATE INDEX IF NOT EXISTS idx_payment_plan_installments_plan_id ON "{{schema}}".payment_plan_installments(plan_id);
