ALTER TABLE "{{schema}}".parcel_calculations
  ADD COLUMN IF NOT EXISTS plan_notlari_file_url TEXT,
  ADD COLUMN IF NOT EXISTS plan_notlari_extracted JSONB,
  ADD COLUMN IF NOT EXISTS imar_durumu_file_url TEXT,
  ADD COLUMN IF NOT EXISTS imar_durumu_extracted JSONB;
