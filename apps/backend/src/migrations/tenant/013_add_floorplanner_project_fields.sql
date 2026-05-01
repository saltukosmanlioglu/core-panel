ALTER TABLE "{{schema}}".projects
  ADD COLUMN IF NOT EXISTS floorplanner_user_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS floorplanner_project_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS floorplanner_synced_at TIMESTAMPTZ;

