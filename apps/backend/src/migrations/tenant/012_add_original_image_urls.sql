ALTER TABLE "{{schema}}".project_3d_models
  ADD COLUMN IF NOT EXISTS original_image_urls JSONB;
