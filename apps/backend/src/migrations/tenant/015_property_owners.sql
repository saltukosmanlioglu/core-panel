CREATE TABLE IF NOT EXISTS "{{schema}}".property_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  id_number VARCHAR(20),
  floor_number INTEGER,
  apartment_number VARCHAR(20),
  apartment_size_sqm DECIMAL(10,2),
  share_percentage DECIMAL(5,2),
  apartment_count INTEGER DEFAULT 1,
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_owners_project_id ON "{{schema}}".property_owners(project_id);
