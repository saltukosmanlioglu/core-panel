import { TenantDb } from '../../lib/tenantDb';

interface OfferRow {
  id: string;
  tender_id: string;
  tenant_id: string;
  tenant_name: string | null;
  status: string;
  submitted_at: Date | null;
  reviewed_at: Date | null;
  reviewed_by: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

interface OfferItemRow {
  id: string;
  offer_id: string;
  item_id: string;
  row_no: number;
  pos_no: string | null;
  description: string;
  unit: string;
  quantity: string;
  category_id: string | null;
  category_name: string | null;
  material_unit_price: string;
  labor_unit_price: string;
  created_at: Date;
  updated_at: Date;
}

function mapOffer(row: OfferRow) {
  return {
    id: row.id,
    tenderId: row.tender_id,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOfferItem(row: OfferItemRow) {
  const qty = parseFloat(row.quantity);
  const mat = parseFloat(row.material_unit_price);
  const lab = parseFloat(row.labor_unit_price);
  const unitPrice = mat + lab;
  const tutar = qty * unitPrice;
  return {
    id: row.id,
    offerId: row.offer_id,
    itemId: row.item_id,
    rowNo: row.row_no,
    posNo: row.pos_no,
    description: row.description,
    unit: row.unit,
    quantity: row.quantity,
    categoryId: row.category_id,
    categoryName: row.category_name,
    materialUnitPrice: row.material_unit_price,
    laborUnitPrice: row.labor_unit_price,
    unitPrice: unitPrice.toFixed(2),
    tutar: tutar.toFixed(2),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type OfferRecord = ReturnType<typeof mapOffer>;
export type OfferItemRecord = ReturnType<typeof mapOfferItem>;

export async function findByTenderId(companyId: string, tenderId: string): Promise<OfferRecord[]> {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<OfferRow>(
    `SELECT o.*, t.name AS tenant_name
     FROM ${tdb.ref('tender_offers')} o
     LEFT JOIN public.tenants t ON o.tenant_id = t.id
     WHERE o.tender_id = $1
     ORDER BY o.created_at ASC`,
    [tenderId],
  );
  return rows.map(mapOffer);
}

export async function findByTenderAndTenant(
  companyId: string,
  tenderId: string,
  tenantId: string,
): Promise<OfferRecord | null> {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<OfferRow>(
    `SELECT o.*, t.name AS tenant_name
     FROM ${tdb.ref('tender_offers')} o
     LEFT JOIN public.tenants t ON o.tenant_id = t.id
     WHERE o.tender_id = $1 AND o.tenant_id = $2 LIMIT 1`,
    [tenderId, tenantId],
  );
  return rows[0] ? mapOffer(rows[0]) : null;
}

export async function findById(companyId: string, id: string): Promise<OfferRecord | null> {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<OfferRow>(
    `SELECT o.*, t.name AS tenant_name
     FROM ${tdb.ref('tender_offers')} o
     LEFT JOIN public.tenants t ON o.tenant_id = t.id
     WHERE o.id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] ? mapOffer(rows[0]) : null;
}

export async function upsert(
  companyId: string,
  tenderId: string,
  tenantId: string,
): Promise<OfferRecord> {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<OfferRow>(
    `INSERT INTO ${tdb.ref('tender_offers')} (tender_id, tenant_id, status)
     VALUES ($1, $2, 'draft')
     ON CONFLICT (tender_id, tenant_id) DO UPDATE SET updated_at = NOW()
     RETURNING *, NULL::text AS tenant_name`,
    [tenderId, tenantId],
  );
  return mapOffer(rows[0]!);
}

export async function updateStatus(
  companyId: string,
  id: string,
  status: string,
  reviewedBy?: string,
  notes?: string,
): Promise<OfferRecord | null> {
  const tdb = new TenantDb(companyId);
  const setClauses: string[] = ['status = $1', 'updated_at = NOW()'];
  const params: unknown[] = [status];

  if (status === 'submitted') {
    setClauses.push('submitted_at = NOW()');
  }
  if (status === 'approved' || status === 'rejected') {
    setClauses.push('reviewed_at = NOW()');
    if (reviewedBy) { params.push(reviewedBy); setClauses.push(`reviewed_by = $${params.length}`); }
    if (notes !== undefined) { params.push(notes); setClauses.push(`notes = $${params.length}`); }
  }

  params.push(id);
  const { rows } = await tdb.query<OfferRow>(
    `UPDATE ${tdb.ref('tender_offers')} SET ${setClauses.join(', ')}
     WHERE id = $${params.length}
     RETURNING *, NULL::text AS tenant_name`,
    params,
  );
  return rows[0] ? mapOffer(rows[0]) : null;
}

export async function findOfferItems(companyId: string, offerId: string): Promise<OfferItemRecord[]> {
  const tdb = new TenantDb(companyId);
  const oi = tdb.ref('tender_offer_items');
  const ti = tdb.ref('tender_items');
  const tc = tdb.ref('tender_categories');
  const { rows } = await tdb.query<OfferItemRow>(
    `SELECT oi.*, ti.row_no, ti.pos_no, ti.description, ti.unit, ti.quantity,
            ti.category_id, tc.name AS category_name
     FROM ${oi} oi
     JOIN ${ti} ti ON oi.item_id = ti.id
     LEFT JOIN ${tc} tc ON ti.category_id = tc.id
     WHERE oi.offer_id = $1
     ORDER BY ti.order_no ASC, ti.row_no ASC`,
    [offerId],
  );
  return rows.map(mapOfferItem);
}

export async function upsertOfferItem(
  companyId: string,
  offerId: string,
  itemId: string,
  materialUnitPrice: number,
  laborUnitPrice: number,
): Promise<void> {
  const tdb = new TenantDb(companyId);
  await tdb.query(
    `INSERT INTO ${tdb.ref('tender_offer_items')} (offer_id, item_id, material_unit_price, labor_unit_price)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (offer_id, item_id) DO UPDATE
       SET material_unit_price = $3, labor_unit_price = $4, updated_at = NOW()`,
    [offerId, itemId, materialUnitPrice, laborUnitPrice],
  );
}

interface ComparisonItemRow {
  item_id: string;
  category_id: string | null;
  category_name: string | null;
  row_no: number;
  pos_no: string | null;
  description: string;
  unit: string;
  quantity: string;
  location: string | null;
  offer_id: string | null;
  tenant_id: string | null;
  tenant_name: string | null;
  offer_status: string | null;
  material_unit_price: string | null;
  labor_unit_price: string | null;
  submitted_at: Date | null;
}

export async function getOfferComparison(
  companyId: string,
  tenderId: string,
): Promise<{
  offers: { id: string; tenantId: string; tenantName: string | null; status: string; submittedAt: Date | null; total: string }[];
  items: {
    id: string; categoryId: string | null; categoryName: string | null;
    rowNo: number; posNo: string | null; description: string; unit: string;
    quantity: string; location: string | null;
    prices: { offerId: string; tenantId: string; materialUnitPrice: string; laborUnitPrice: string; unitPrice: string; tutar: string }[];
  }[];
}> {
  const tdb = new TenantDb(companyId);
  const ti = tdb.ref('tender_items');
  const tc = tdb.ref('tender_categories');
  const to = tdb.ref('tender_offers');
  const toi = tdb.ref('tender_offer_items');

  // Get all items
  const { rows: itemRows } = await tdb.query<{
    id: string; category_id: string | null; category_name: string | null;
    row_no: number; pos_no: string | null; description: string; unit: string;
    quantity: string; location: string | null;
  }>(
    `SELECT i.id, i.category_id, c.name AS category_name,
            i.row_no, i.pos_no, i.description, i.unit, i.quantity, i.location
     FROM ${ti} i
     LEFT JOIN ${tc} c ON i.category_id = c.id
     WHERE i.tender_id = $1
     ORDER BY i.order_no ASC, i.row_no ASC`,
    [tenderId],
  );

  // Get all offers with tenant names
  const { rows: offerRows } = await tdb.query<{
    id: string; tenant_id: string; tenant_name: string | null;
    status: string; submitted_at: Date | null;
  }>(
    `SELECT o.id, o.tenant_id, t.name AS tenant_name, o.status, o.submitted_at
     FROM ${to} o
     LEFT JOIN public.tenants t ON o.tenant_id = t.id
     WHERE o.tender_id = $1
     ORDER BY o.created_at ASC`,
    [tenderId],
  );

  // Get all offer items for this tender's offers
  const { rows: priceRows } = await tdb.query<{
    offer_id: string; item_id: string; tenant_id: string;
    material_unit_price: string; labor_unit_price: string;
  }>(
    `SELECT oi.offer_id, oi.item_id, o.tenant_id,
            oi.material_unit_price, oi.labor_unit_price
     FROM ${toi} oi
     JOIN ${to} o ON oi.offer_id = o.id
     WHERE o.tender_id = $1`,
    [tenderId],
  );

  // Build price map: itemId -> offerId -> prices
  const priceMap = new Map<string, Map<string, { offerId: string; tenantId: string; mat: number; lab: number }>>();
  for (const p of priceRows) {
    if (!priceMap.has(p.item_id)) priceMap.set(p.item_id, new Map());
    priceMap.get(p.item_id)!.set(p.offer_id, {
      offerId: p.offer_id,
      tenantId: p.tenant_id,
      mat: parseFloat(p.material_unit_price),
      lab: parseFloat(p.labor_unit_price),
    });
  }

  // Build offer totals
  const offerTotals = new Map<string, number>();
  for (const item of itemRows) {
    const qty = parseFloat(item.quantity);
    const itemPrices = priceMap.get(item.id);
    if (!itemPrices) continue;
    for (const [offerId, prices] of itemPrices) {
      const tutar = qty * (prices.mat + prices.lab);
      offerTotals.set(offerId, (offerTotals.get(offerId) ?? 0) + tutar);
    }
  }

  const offers = offerRows.map((o) => ({
    id: o.id,
    tenantId: o.tenant_id,
    tenantName: o.tenant_name,
    status: o.status,
    submittedAt: o.submitted_at,
    total: (offerTotals.get(o.id) ?? 0).toFixed(2),
  }));

  const items = itemRows.map((item) => {
    const qty = parseFloat(item.quantity);
    const itemPrices = priceMap.get(item.id) ?? new Map();
    const prices = offerRows.map((o) => {
      const p = itemPrices.get(o.id);
      if (!p) return { offerId: o.id, tenantId: o.tenant_id, materialUnitPrice: '0', laborUnitPrice: '0', unitPrice: '0', tutar: '0' };
      const unitPrice = p.mat + p.lab;
      return {
        offerId: o.id,
        tenantId: o.tenant_id,
        materialUnitPrice: p.mat.toFixed(2),
        laborUnitPrice: p.lab.toFixed(2),
        unitPrice: unitPrice.toFixed(2),
        tutar: (qty * unitPrice).toFixed(2),
      };
    });
    return {
      id: item.id,
      categoryId: item.category_id,
      categoryName: item.category_name,
      rowNo: item.row_no,
      posNo: item.pos_no,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      location: item.location,
      prices,
    };
  });

  return { offers, items };
}
