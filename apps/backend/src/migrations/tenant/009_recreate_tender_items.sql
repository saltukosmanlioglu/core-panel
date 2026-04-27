CREATE TABLE "{{schema}}".tender_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID NOT NULL REFERENCES "{{schema}}".tenders(id) ON DELETE CASCADE,
  row_no INTEGER NOT NULL,
  pos_no VARCHAR(50),
  description TEXT NOT NULL,
  unit VARCHAR(50) NOT NULL,
  quantity NUMERIC(15,3) NOT NULL DEFAULT 0,
  location VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tender_id, row_no)
);

CREATE INDEX idx_tender_items_tender_id ON "{{schema}}".tender_items(tender_id);
