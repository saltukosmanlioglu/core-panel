import { TenantDb } from '../../lib/tenantDb';

interface ItemRow {
  id: string;
  tender_id: string;
  category_id: string | null;
  category_name: string | null;
  row_no: number;
  pos_no: string | null;
  description: string;
  unit: string;
  quantity: string;
  location: string | null;
  order_no: number;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: ItemRow) {
  return {
    id: row.id,
    tenderId: row.tender_id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    rowNo: row.row_no,
    posNo: row.pos_no,
    description: row.description,
    unit: row.unit,
    quantity: row.quantity,
    location: row.location,
    orderNo: row.order_no,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type ItemRecord = ReturnType<typeof mapRow>;

export async function findByTenderId(companyId: string, tenderId: string): Promise<ItemRecord[]> {
  const tdb = new TenantDb(companyId);
  const items = tdb.ref('tender_items');
  const cats = tdb.ref('tender_categories');
  const { rows } = await tdb.query<ItemRow>(
    `SELECT i.*, c.name AS category_name
     FROM ${items} i
     LEFT JOIN ${cats} c ON i.category_id = c.id
     WHERE i.tender_id = $1
     ORDER BY i.order_no ASC, i.row_no ASC`,
    [tenderId],
  );
  return rows.map(mapRow);
}

export async function findById(companyId: string, id: string): Promise<ItemRecord | null> {
  const tdb = new TenantDb(companyId);
  const items = tdb.ref('tender_items');
  const cats = tdb.ref('tender_categories');
  const { rows } = await tdb.query<ItemRow>(
    `SELECT i.*, c.name AS category_name
     FROM ${items} i
     LEFT JOIN ${cats} c ON i.category_id = c.id
     WHERE i.id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function create(
  companyId: string,
  tenderId: string,
  data: {
    categoryId?: string | null;
    rowNo: number;
    posNo?: string;
    description: string;
    unit: string;
    quantity: number;
    location?: string;
    orderNo?: number;
  },
): Promise<ItemRecord> {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<ItemRow>(
    `INSERT INTO ${tdb.ref('tender_items')}
       (tender_id, category_id, row_no, pos_no, description, unit, quantity, location, order_no)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *, NULL::text AS category_name`,
    [
      tenderId,
      data.categoryId ?? null,
      data.rowNo,
      data.posNo ?? null,
      data.description,
      data.unit,
      data.quantity,
      data.location ?? null,
      data.orderNo ?? 0,
    ],
  );
  return mapRow(rows[0]!);
}

export async function update(
  companyId: string,
  id: string,
  data: {
    categoryId?: string | null;
    rowNo?: number;
    posNo?: string;
    description?: string;
    unit?: string;
    quantity?: number;
    location?: string;
    orderNo?: number;
  },
): Promise<ItemRecord | null> {
  const tdb = new TenantDb(companyId);
  const setClauses: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];

  if (data.categoryId !== undefined) { params.push(data.categoryId); setClauses.push(`category_id = $${params.length}`); }
  if (data.rowNo !== undefined) { params.push(data.rowNo); setClauses.push(`row_no = $${params.length}`); }
  if (data.posNo !== undefined) { params.push(data.posNo); setClauses.push(`pos_no = $${params.length}`); }
  if (data.description !== undefined) { params.push(data.description); setClauses.push(`description = $${params.length}`); }
  if (data.unit !== undefined) { params.push(data.unit); setClauses.push(`unit = $${params.length}`); }
  if (data.quantity !== undefined) { params.push(data.quantity); setClauses.push(`quantity = $${params.length}`); }
  if (data.location !== undefined) { params.push(data.location); setClauses.push(`location = $${params.length}`); }
  if (data.orderNo !== undefined) { params.push(data.orderNo); setClauses.push(`order_no = $${params.length}`); }

  params.push(id);
  const { rows } = await tdb.query<ItemRow>(
    `UPDATE ${tdb.ref('tender_items')} SET ${setClauses.join(', ')} WHERE id = $${params.length}
     RETURNING *, NULL::text AS category_name`,
    params,
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function remove(companyId: string, id: string): Promise<boolean> {
  const tdb = new TenantDb(companyId);
  const { rowCount } = await tdb.query(
    `DELETE FROM ${tdb.ref('tender_items')} WHERE id = $1`,
    [id],
  );
  return rowCount > 0;
}

export async function reorder(companyId: string, items: { id: string; orderNo: number }[]): Promise<void> {
  if (items.length === 0) return;
  const tdb = new TenantDb(companyId);
  // Use a VALUES list to update all at once
  const valueParts = items.map((_, i) => `($${i * 2 + 1}::uuid, $${i * 2 + 2}::int)`).join(', ');
  const params = items.flatMap((item) => [item.id, item.orderNo]);
  await tdb.query(
    `UPDATE ${tdb.ref('tender_items')} AS t
     SET order_no = v.order_no, updated_at = NOW()
     FROM (VALUES ${valueParts}) AS v(id, order_no)
     WHERE t.id = v.id`,
    params,
  );
}
