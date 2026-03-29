CREATE TABLE IF NOT EXISTS "{{schema}}".tender_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id  UUID NOT NULL REFERENCES "{{schema}}".tenders(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  order_no   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "{{schema}}".tender_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id   UUID NOT NULL REFERENCES "{{schema}}".tenders(id) ON DELETE CASCADE,
  category_id UUID REFERENCES "{{schema}}".tender_categories(id) ON DELETE SET NULL,
  row_no      INTEGER NOT NULL,
  pos_no      VARCHAR(50),
  description TEXT NOT NULL,
  unit        VARCHAR(50) NOT NULL,
  quantity    NUMERIC(15,3) NOT NULL DEFAULT 0,
  location    VARCHAR(255),
  order_no    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "{{schema}}".tender_invitations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id  UUID NOT NULL REFERENCES "{{schema}}".tenders(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tender_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS "{{schema}}".tender_offers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id   UUID NOT NULL REFERENCES "{{schema}}".tenders(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL,
  status      VARCHAR(50) NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  reviewed_at  TIMESTAMPTZ,
  reviewed_by  UUID,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tender_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS "{{schema}}".tender_offer_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id            UUID NOT NULL REFERENCES "{{schema}}".tender_offers(id) ON DELETE CASCADE,
  item_id             UUID NOT NULL REFERENCES "{{schema}}".tender_items(id) ON DELETE CASCADE,
  material_unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  labor_unit_price    NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(offer_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_tender_categories_tender_id   ON "{{schema}}".tender_categories(tender_id);
CREATE INDEX IF NOT EXISTS idx_tender_items_tender_id        ON "{{schema}}".tender_items(tender_id);
CREATE INDEX IF NOT EXISTS idx_tender_items_category_id      ON "{{schema}}".tender_items(category_id);
CREATE INDEX IF NOT EXISTS idx_tender_invitations_tender_id  ON "{{schema}}".tender_invitations(tender_id);
CREATE INDEX IF NOT EXISTS idx_tender_offers_tender_id       ON "{{schema}}".tender_offers(tender_id);
CREATE INDEX IF NOT EXISTS idx_tender_offers_tenant_id       ON "{{schema}}".tender_offers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tender_offer_items_offer_id   ON "{{schema}}".tender_offer_items(offer_id);
