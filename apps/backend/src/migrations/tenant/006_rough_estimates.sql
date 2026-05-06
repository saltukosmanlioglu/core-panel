CREATE TABLE IF NOT EXISTS "{{schema}}".rough_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES "{{schema}}".projects(id) ON DELETE CASCADE,
  title VARCHAR(255),
  offer_letter_title VARCHAR(255),
  offer_letter_content TEXT,
  net_parcel_area DECIMAL(10,3),
  total_brut_area DECIMAL(10,3),
  basement_area DECIMAL(10,3) DEFAULT 0,
  floor_count INTEGER DEFAULT 1,
  has_roof_unit BOOLEAN DEFAULT false,
  cost_per_sqm DECIMAL(15,2),
  total_cost DECIMAL(15,2),
  offer_valid_until TIMESTAMPTZ,
  delivery_months INTEGER DEFAULT 10,
  usd_rate DECIMAL(10,2),
  status VARCHAR(50) DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rough_estimates_project_id 
  ON "{{schema}}".rough_estimates(project_id);

CREATE TABLE IF NOT EXISTS "{{schema}}".rough_estimate_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES "{{schema}}".rough_estimates(id) ON DELETE CASCADE,
  floor_number INTEGER,
  floor_label VARCHAR(100),
  unit_number VARCHAR(50),
  owner_type VARCHAR(50) DEFAULT 'property_owner',
  owner_name VARCHAR(255),
  gross_area DECIMAL(10,2),
  fire_escape_area DECIMAL(10,2),
  has_payment BOOLEAN DEFAULT false,
  payment_amount DECIMAL(15,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
