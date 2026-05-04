CREATE TABLE IF NOT EXISTS "{{schema}}".area_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',

  -- Uploaded file paths
  rolovesi_path TEXT,
  eimar_path TEXT,
  plan_notes_path TEXT,
  other_files JSONB DEFAULT '[]',

  -- Raw Claude JSON output
  extracted_data JSONB,

  -- Calculated results
  calculated_results JSONB,

  warnings JSONB DEFAULT '[]',
  note TEXT,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_area_calculations_project_id ON "{{schema}}".area_calculations(project_id);
CREATE INDEX IF NOT EXISTS idx_area_calculations_created_at ON "{{schema}}".area_calculations(created_at);
