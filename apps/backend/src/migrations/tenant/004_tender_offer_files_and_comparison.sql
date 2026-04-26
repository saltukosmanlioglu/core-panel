DROP TABLE IF EXISTS "{{schema}}".tender_offer_items CASCADE;
DROP TABLE IF EXISTS "{{schema}}".tender_offers CASCADE;
DROP TABLE IF EXISTS "{{schema}}".tender_categories CASCADE;
DROP TABLE IF EXISTS "{{schema}}".tender_items CASCADE;

CREATE TABLE "{{schema}}".tender_offer_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID NOT NULL REFERENCES "{{schema}}".tenders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  stored_name VARCHAR(500) NOT NULL,
  file_path VARCHAR(1000) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tender_id, tenant_id)
);

CREATE TABLE "{{schema}}".tender_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID NOT NULL REFERENCES "{{schema}}".tenders(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  result_json JSONB,
  error_message TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tender_offer_files_tender_id ON "{{schema}}".tender_offer_files(tender_id);
CREATE INDEX IF NOT EXISTS idx_tender_offer_files_tenant_id ON "{{schema}}".tender_offer_files(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tender_comparisons_tender_id ON "{{schema}}".tender_comparisons(tender_id);
