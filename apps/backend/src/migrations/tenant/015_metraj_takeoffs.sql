CREATE TABLE IF NOT EXISTS "{{schema}}".metraj_takeoffs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID NOT NULL REFERENCES "{{schema}}".projects(id) ON DELETE CASCADE,
  name                  VARCHAR(255) NOT NULL DEFAULT 'Metraj',
  parcel_calculation_id UUID,
  floor_types           JSONB NOT NULL DEFAULT '[]',
  -- [{ id, label, quantity, rooms: [{ id, name, length, width, ceilingHeight }], openings: [{ id, type, label, width, height, quantity }] }]
  rough_construction    JSONB NOT NULL DEFAULT '{}',
  status                VARCHAR(50) NOT NULL DEFAULT 'draft',
  created_by            UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE "{{schema}}".metraj_takeoffs
  ADD COLUMN IF NOT EXISTS rough_construction JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_metraj_takeoffs_project_id
  ON "{{schema}}".metraj_takeoffs(project_id);
