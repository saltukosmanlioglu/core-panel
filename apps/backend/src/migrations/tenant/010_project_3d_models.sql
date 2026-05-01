CREATE TABLE IF NOT EXISTS "{{schema}}".project_3d_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES "{{schema}}".projects(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  texture_prompt TEXT,
  enhanced_prompt TEXT,
  meshy_task_id VARCHAR(255),
  meshy_texture_task_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'PENDING',
  progress INTEGER DEFAULT 0,
  file_path TEXT,
  thumbnail_url TEXT,
  model_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_3d_models_project_id ON "{{schema}}".project_3d_models(project_id);
CREATE INDEX IF NOT EXISTS idx_project_3d_models_status ON "{{schema}}".project_3d_models(status);
CREATE INDEX IF NOT EXISTS idx_project_3d_models_created_at ON "{{schema}}".project_3d_models(created_at);
