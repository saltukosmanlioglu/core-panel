-- Drop the incorrectly-structured tables created by 006_rough_estimates
DROP TABLE IF EXISTS "{{schema}}".rough_estimate_units;
DROP TABLE IF EXISTS "{{schema}}".rough_estimates;

-- Recreate with the correct schema
CREATE TABLE "{{schema}}".rough_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES "{{schema}}".projects(id) ON DELETE CASCADE,
  net_parcel_area DECIMAL(15,2),
  taks_min DECIMAL(5,3),
  taks_max DECIMAL(5,3),
  kaks DECIMAL(5,3),
  regulation_bonus_percent DECIMAL(5,2) DEFAULT 30,
  basement_area DECIMAL(15,2) DEFAULT 0,
  second_basement_area DECIMAL(15,2) DEFAULT 0,
  third_basement_area DECIMAL(15,2) DEFAULT 0,
  min_base_area DECIMAL(15,2),
  max_base_area DECIMAL(15,2),
  max_construction_area DECIMAL(15,2),
  regulation_bonus_area DECIMAL(15,2),
  total_brut_area DECIMAL(15,2),
  floor_count INTEGER DEFAULT 0,
  units_per_floor INTEGER DEFAULT 2,
  has_roof_unit BOOLEAN DEFAULT FALSE,
  roof_unit_area DECIMAL(10,2) DEFAULT 0,
  total_construction_cost DECIMAL(15,2),
  cost_per_sqm DECIMAL(15,2),
  currency VARCHAR(10) DEFAULT 'TRY',
  usd_rate DECIMAL(10,2),
  project_title VARCHAR(500),
  offer_valid_until DATE,
  delivery_months INTEGER DEFAULT 10,
  offer_letter_title VARCHAR(500),
  offer_letter_content TEXT,
  notes TEXT,
  status VARCHAR(50) DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE "{{schema}}".rough_estimate_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES "{{schema}}".rough_estimates(id) ON DELETE CASCADE,
  floor_number INTEGER NOT NULL,
  floor_label VARCHAR(100),
  unit_number INTEGER NOT NULL,
  block VARCHAR(50),
  unit_type VARCHAR(50) DEFAULT 'apartment',
  owner_type VARCHAR(50) DEFAULT 'property_owner',
  owner_name VARCHAR(255),
  property_owner_id UUID,
  gross_area DECIMAL(10,2),
  fire_escape_area DECIMAL(10,2) DEFAULT 0,
  has_payment BOOLEAN DEFAULT TRUE,
  payment_amount DECIMAL(15,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rough_estimates_project_id ON "{{schema}}".rough_estimates(project_id);
CREATE INDEX IF NOT EXISTS idx_rough_estimates_created_at ON "{{schema}}".rough_estimates(created_at);
CREATE INDEX IF NOT EXISTS idx_rough_estimate_units_estimate_id ON "{{schema}}".rough_estimate_units(estimate_id);
CREATE INDEX IF NOT EXISTS idx_rough_estimate_units_sort ON "{{schema}}".rough_estimate_units(estimate_id, floor_number, unit_number);
