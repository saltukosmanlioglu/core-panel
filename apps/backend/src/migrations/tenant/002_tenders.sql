CREATE TABLE IF NOT EXISTS "{{schema}}".tenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES "{{schema}}".projects(id) ON DELETE CASCADE,
  category_id UUID REFERENCES "{{schema}}".categories(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft',
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenders_project_id 
  ON "{{schema}}".tenders(project_id);
CREATE INDEX IF NOT EXISTS idx_tenders_status 
  ON "{{schema}}".tenders(status);

CREATE TABLE IF NOT EXISTS "{{schema}}".tender_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID NOT NULL REFERENCES "{{schema}}".tenders(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "{{schema}}".tender_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID NOT NULL REFERENCES "{{schema}}".tenders(id) ON DELETE CASCADE,
  category_id UUID REFERENCES "{{schema}}".tender_categories(id) ON DELETE SET NULL,
  row_no INTEGER NOT NULL,
  pos_no VARCHAR(50),
  description TEXT NOT NULL,
  unit VARCHAR(50) NOT NULL,
  quantity DECIMAL(15,3) DEFAULT 0,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tender_id, row_no)
);

CREATE TABLE IF NOT EXISTS "{{schema}}".tender_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID NOT NULL REFERENCES "{{schema}}".tenders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tender_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS "{{schema}}".tender_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID NOT NULL REFERENCES "{{schema}}".tenders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tender_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS "{{schema}}".tender_offer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES "{{schema}}".tender_offers(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES "{{schema}}".tender_items(id) ON DELETE CASCADE,
  material_unit_price DECIMAL(15,2) DEFAULT 0,
  labor_unit_price DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(offer_id, item_id)
);

CREATE TABLE IF NOT EXISTS "{{schema}}".tender_offer_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID NOT NULL REFERENCES "{{schema}}".tenders(id) ON DELETE CASCADE,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  mime_type VARCHAR(100),
  file_size INTEGER,
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "{{schema}}".tender_item_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID NOT NULL REFERENCES "{{schema}}".tenders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES "{{schema}}".tender_items(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "{{schema}}".tender_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID NOT NULL REFERENCES "{{schema}}".tenders(id) ON DELETE CASCADE,
  result_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "{{schema}}".tender_award_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID NOT NULL REFERENCES "{{schema}}".tenders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES "{{schema}}".tender_items(id) ON DELETE SET NULL,
  awarded_tenant_id UUID,
  sira_no INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tender_id, sira_no)
);

CREATE TABLE IF NOT EXISTS "{{schema}}".tender_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID NOT NULL REFERENCES "{{schema}}".tenders(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  details JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tender_audit_tender_id 
  ON "{{schema}}".tender_audit_logs(tender_id);
CREATE INDEX IF NOT EXISTS idx_tender_audit_created_at 
  ON "{{schema}}".tender_audit_logs(created_at);
