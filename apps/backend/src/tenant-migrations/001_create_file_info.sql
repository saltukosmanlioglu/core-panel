-- Tenant migration 001: file_info table
-- Applied automatically to every new company schema.
-- The actual runtime version lives in schemaService.ts (TENANT_MIGRATIONS array).
-- This file is the canonical SQL reference for documentation and manual inspection.

CREATE TABLE IF NOT EXISTS file_info (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  file_name    VARCHAR(255) NOT NULL,
  file_type    VARCHAR(100) NOT NULL,
  file_size    BIGINT NOT NULL,
  file_path    TEXT NOT NULL,
  mime_type    VARCHAR(100),
  uploaded_by  TEXT NOT NULL,        -- references public.users.id
  description  TEXT,
  tags         TEXT[],               -- PostgreSQL array for flexible tagging
  is_archived  BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_info_uploaded_by ON file_info(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_file_info_created_at  ON file_info(created_at);
CREATE INDEX IF NOT EXISTS idx_file_info_is_archived ON file_info(is_archived);
