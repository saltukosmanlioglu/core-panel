ALTER TABLE "{{schema}}".project_3d_models
  ADD COLUMN IF NOT EXISTS preview_image_urls JSONB,
  ADD COLUMN IF NOT EXISTS selected_image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_task_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS generation_step VARCHAR(50) DEFAULT 'PENDING';
