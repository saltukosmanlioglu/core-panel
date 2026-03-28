CREATE TABLE IF NOT EXISTS "{{schema}}".file_info (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  file_name    VARCHAR(255) NOT NULL,
  file_type    VARCHAR(100) NOT NULL,
  file_size    BIGINT NOT NULL,
  file_path    TEXT NOT NULL,
  mime_type    VARCHAR(100),
  uploaded_by  TEXT NOT NULL,
  description  TEXT,
  tags         TEXT[],
  is_archived  BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_file_info_uploaded_by ON "{{schema}}".file_info(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_file_info_created_at  ON "{{schema}}".file_info(created_at);
CREATE INDEX IF NOT EXISTS idx_file_info_is_archived ON "{{schema}}".file_info(is_archived);
