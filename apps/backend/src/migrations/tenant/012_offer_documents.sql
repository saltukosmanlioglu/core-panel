CREATE TABLE IF NOT EXISTS "{{schema}}".offer_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES "{{schema}}".projects(id) ON DELETE CASCADE,

  -- Page 1
  parcel_title TEXT NOT NULL,
  offer_date DATE NOT NULL,

  -- Page 2
  page2_content TEXT NOT NULL,
  tcmb_rate TEXT NOT NULL DEFAULT '1 Dolar (USD): 45,45 TL',

  -- Page 3: full building definition as JSONB
  -- {
  --   staircaseDeduction: number,
  --   basementFloors: [
  --     {
  --       label: string,
  --       isCommonArea: boolean,
  --       commonAreaM2: number | null,
  --       commonAreaLabel: string | null,
  --       units: [
  --         {
  --           id: number,
  --           ownerType: "mila" | "tapu",
  --           ownerName: string,
  --           brutM2: number,
  --           paymentAmount: number | null,
  --           label: string | null
  --         }
  --       ],
  --       streetLabels: {
  --         left: string | null,
  --         right: string | null,
  --         bottom: string | null
  --       }
  --     }
  --   ],
  --   groundFloor: {
  --     exists: boolean,
  --     units: [ ...same unit shape... ],
  --     streetLabels: { left, right, bottom }
  --   },
  --   normalFloors: [
  --     {
  --       floorNumber: number,
  --       units: [ ...same unit shape... ]
  --     }
  --   ],
  --   roofFloor: {
  --     exists: boolean,
  --     units: [ ...same unit shape... ]
  --   }
  -- }
  building JSONB NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offer_documents_project_id
  ON "{{schema}}".offer_documents(project_id);
