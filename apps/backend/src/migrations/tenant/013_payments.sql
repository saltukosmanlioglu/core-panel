CREATE TABLE IF NOT EXISTS "{{schema}}".progress_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  tender_id UUID,
  tenant_id VARCHAR(255) NOT NULL,
  period VARCHAR(255),
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  remaining_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  due_date DATE,
  payment_frequency VARCHAR(50) DEFAULT 'none',
  note TEXT,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "{{schema}}".progress_payment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES "{{schema}}".progress_payments(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(15,2) DEFAULT 1,
  unit VARCHAR(50),
  unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "{{schema}}".progress_payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES "{{schema}}".progress_payments(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  receipt_path TEXT,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "{{schema}}".general_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'other',
  description TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  invoice_path TEXT,
  payment_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  note TEXT,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "{{schema}}".payment_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  user_id UUID,
  type VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  related_id UUID,
  related_type VARCHAR(50),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_progress_payments_project_id ON "{{schema}}".progress_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_progress_payments_tenant_id ON "{{schema}}".progress_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_progress_payments_due_date ON "{{schema}}".progress_payments(due_date);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_id ON "{{schema}}".progress_payment_transactions(payment_id);
CREATE INDEX IF NOT EXISTS idx_general_expenses_project_id ON "{{schema}}".general_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_user_id ON "{{schema}}".payment_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_related ON "{{schema}}".payment_notifications(related_id, related_type, type);
