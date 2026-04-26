CREATE TABLE "{{schema}}".tender_item_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID NOT NULL REFERENCES "{{schema}}".tenders(id) ON DELETE CASCADE,
  sira_no INTEGER NOT NULL,
  note TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tender_id, sira_no)
);
