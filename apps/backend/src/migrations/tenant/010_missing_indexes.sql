CREATE INDEX IF NOT EXISTS idx_tender_items_tender_id
  ON "{{schema}}".tender_items(tender_id);

CREATE INDEX IF NOT EXISTS idx_tender_categories_tender_id
  ON "{{schema}}".tender_categories(tender_id);

CREATE INDEX IF NOT EXISTS idx_tender_offer_items_offer_id
  ON "{{schema}}".tender_offer_items(offer_id);

CREATE INDEX IF NOT EXISTS idx_tender_item_notes_tender_id
  ON "{{schema}}".tender_item_notes(tender_id);

CREATE INDEX IF NOT EXISTS idx_tender_item_notes_item_id
  ON "{{schema}}".tender_item_notes(item_id);

CREATE INDEX IF NOT EXISTS idx_tender_award_items_tender_id
  ON "{{schema}}".tender_award_items(tender_id);
