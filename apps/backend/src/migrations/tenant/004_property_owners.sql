CREATE TABLE IF NOT EXISTS "{{schema}}".property_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES "{{schema}}".projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  floor_number INTEGER,
  apartment_number VARCHAR(50),
  apartment_size_sqm DECIMAL(10,2),
  share_percentage DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_owners_project_id 
  ON "{{schema}}".property_owners(project_id);

CREATE TABLE IF NOT EXISTS "{{schema}}".payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_owner_id UUID NOT NULL REFERENCES "{{schema}}".property_owners(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES "{{schema}}".projects(id) ON DELETE CASCADE,
  title VARCHAR(255),
  total_amount DECIMAL(15,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'TRY',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "{{schema}}".payment_plan_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_plan_id UUID NOT NULL REFERENCES "{{schema}}".payment_plans(id) ON DELETE CASCADE,
  title VARCHAR(255),
  amount DECIMAL(15,2) NOT NULL,
  due_date TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  receipt_path TEXT,
  receipt_original_name VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
