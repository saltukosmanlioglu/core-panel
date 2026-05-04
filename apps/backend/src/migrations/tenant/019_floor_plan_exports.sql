CREATE TABLE IF NOT EXISTS "{{schema}}".floor_plan_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES "{{schema}}".projects(id) ON DELETE CASCADE,
  floorplanner_export_id TEXT,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, floorplanner_export_id)
);

CREATE INDEX IF NOT EXISTS floor_plan_exports_project_id_idx
  ON "{{schema}}".floor_plan_exports (project_id);
