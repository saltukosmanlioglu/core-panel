ALTER TABLE "{{schema}}".offer_documents
  ADD COLUMN IF NOT EXISTS parcel_calculation_id UUID,
  ADD COLUMN IF NOT EXISTS alternatives JSONB NOT NULL DEFAULT '[]';
