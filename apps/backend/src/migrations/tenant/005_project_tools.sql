CREATE TABLE IF NOT EXISTS "{{schema}}".area_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES "{{schema}}".projects(id) ON DELETE CASCADE,
  file_path TEXT,
  file_original_name VARCHAR(255),
  ai_prompt TEXT,
  extracted_data JSONB,
  calculated_results JSONB,
  warnings JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_area_calc_project_id 
  ON "{{schema}}".area_calculations(project_id);
CREATE INDEX IF NOT EXISTS idx_area_calc_created_at 
  ON "{{schema}}".area_calculations(created_at);

CREATE TABLE IF NOT EXISTS "{{schema}}".project_3d_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES "{{schema}}".projects(id) ON DELETE CASCADE,
  name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  meshy_task_id VARCHAR(255),
  preview_image_urls JSONB,
  original_image_urls JSONB,
  selected_image_url TEXT,
  model_url TEXT,
  thumbnail_url TEXT,
  generation_step VARCHAR(50) DEFAULT 'image',
  prompt TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_3d_models_project_id 
  ON "{{schema}}".project_3d_models(project_id);

CREATE TABLE IF NOT EXISTS "{{schema}}".floor_plan_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES "{{schema}}".projects(id) ON DELETE CASCADE,
  floorplanner_export_id VARCHAR(255),
  format VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending',
  file_path TEXT,
  file_url TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
