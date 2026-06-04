ALTER TABLE "{{schema}}".offer_documents
  ADD COLUMN IF NOT EXISTS company_name TEXT NOT NULL DEFAULT '';
