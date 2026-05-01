ALTER TABLE "{{schema}}".projects
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS status_note TEXT,
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS status_updated_by UUID;
