CREATE TABLE "{{schema}}".tender_award_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID NOT NULL REFERENCES "{{schema}}".tenders(id) ON DELETE CASCADE,
  sira_no INTEGER NOT NULL,
  description TEXT,
  awarded_tenant_id UUID,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  note TEXT,
  awarded_by UUID NOT NULL,
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tender_id, sira_no)
);

CREATE TABLE "{{schema}}".tender_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID NOT NULL REFERENCES "{{schema}}".tenders(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  details JSONB,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tender_award_items_tender_id
  ON "{{schema}}".tender_award_items(tender_id);

CREATE INDEX idx_tender_audit_logs_tender_id
  ON "{{schema}}".tender_audit_logs(tender_id);

CREATE INDEX idx_tender_audit_logs_created_at
  ON "{{schema}}".tender_audit_logs(created_at);
