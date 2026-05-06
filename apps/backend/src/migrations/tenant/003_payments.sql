CREATE TABLE IF NOT EXISTS "{{schema}}".progress_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES "{{schema}}".projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  total_amount DECIMAL(15,2) DEFAULT 0,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  due_date TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_project_id 
  ON "{{schema}}".progress_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_due_date 
  ON "{{schema}}".progress_payments(due_date);

CREATE TABLE IF NOT EXISTS "{{schema}}".progress_payment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES "{{schema}}".progress_payments(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(15,3) DEFAULT 1,
  unit_price DECIMAL(15,2) DEFAULT 0,
  total_price DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "{{schema}}".progress_payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES "{{schema}}".progress_payments(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  receipt_path TEXT,
  receipt_original_name VARCHAR(255),
  notes TEXT,
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "{{schema}}".general_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES "{{schema}}".projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  category VARCHAR(50) DEFAULT 'other',
  description TEXT,
  expense_date TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "{{schema}}".payment_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES "{{schema}}".projects(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES "{{schema}}".progress_payments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
  ON "{{schema}}".payment_notifications(user_id);
