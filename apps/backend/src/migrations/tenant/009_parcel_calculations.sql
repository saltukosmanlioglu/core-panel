CREATE TABLE IF NOT EXISTS "{{schema}}".parcel_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES "{{schema}}".projects(id) ON DELETE CASCADE,
  name VARCHAR(255) DEFAULT 'Hesaplama',

  -- Parcel edges input
  edges JSONB NOT NULL DEFAULT '[]',
  -- [{ label: "A", length: 10.5, angle: 90 }, ...]

  -- Calculated parcel
  parcel_area DECIMAL(10,2),
  parcel_vertices JSONB,
  -- [{ x: 0, y: 0 }, ...]

  -- Garden setbacks
  setback_source VARCHAR(50) DEFAULT 'manual',
  -- 'manual' | 'document'
  setback_front DECIMAL(6,2) DEFAULT 0,
  setback_back DECIMAL(6,2) DEFAULT 0,
  setback_left DECIMAL(6,2) DEFAULT 0,
  setback_right DECIMAL(6,2) DEFAULT 0,
  setback_document_path TEXT,
  setback_document_name VARCHAR(255),
  setback_raw_text TEXT,

  -- Base footprint (taban oturumu)
  footprint_area DECIMAL(10,2),
  footprint_vertices JSONB,

  -- Floor overhangs (çıkmalar)
  floor_count INTEGER DEFAULT 4,
  overhangs JSONB DEFAULT '[]',
  -- [{ floor: 1, front: 1.5, back: 1.5, left: 1.5, right: 1.5 }]

  -- Results
  total_construction_area DECIMAL(10,2),

  status VARCHAR(50) DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parcel_calc_project_id
  ON "{{schema}}".parcel_calculations(project_id);
