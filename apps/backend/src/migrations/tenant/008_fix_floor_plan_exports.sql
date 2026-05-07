ALTER TABLE "{{schema}}".floor_plan_exports
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS fml_data JSONB,
  ADD COLUMN IF NOT EXISTS plan_metadata JSONB;

UPDATE "{{schema}}".floor_plan_exports
SET image_url = file_url
WHERE image_url IS NULL AND file_url IS NOT NULL;

ALTER TABLE "{{schema}}".project_3d_models
  ADD COLUMN IF NOT EXISTS source_floor_plan_id UUID REFERENCES "{{schema}}".floor_plan_exports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_metadata JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS uq_floor_plan_exports_project_export
  ON "{{schema}}".floor_plan_exports(project_id, floorplanner_export_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_property_owner_unit
  ON "{{schema}}".property_owners(project_id, floor_number, apartment_number);
