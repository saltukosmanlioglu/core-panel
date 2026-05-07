ALTER TABLE "{{schema}}".floor_plan_exports
  ADD COLUMN IF NOT EXISTS sh3do_home_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS sh3do_user_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS ai_generated_xml TEXT,
  ADD COLUMN IF NOT EXISTS plan_json JSONB;

CREATE TABLE IF NOT EXISTS "{{schema}}".floor_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES "{{schema}}".projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL DEFAULT 'Kat Planı',
  floor_number INTEGER DEFAULT 1,
  sh3do_user_id VARCHAR(255),
  sh3do_home_name VARCHAR(255),
  apartment_count INTEGER DEFAULT 1,
  room_type VARCHAR(50),
  total_area DECIMAL(10,2),
  ai_prompt TEXT,
  ai_generated_xml TEXT,
  plan_json JSONB,
  thumbnail_url TEXT,
  status VARCHAR(50) DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_floor_plans_project_id
  ON "{{schema}}".floor_plans(project_id);
