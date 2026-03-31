import { TenantDb } from '../../lib/tenantDb';

interface ItemRow {
  id: string;
  tender_id: string;
  category_id: string | null;
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
  const { rows } = await tdb.query<ItemRow>(
    `SELECT * FROM ${items} WHERE tender_id = $1 ORDER BY order_no ASC, row_no ASC`,
    [tenderId],
  );
  return rows.map(mapRow);
}

export async function findById(companyId: string, id: string): Promise<ItemRecord | null> {
  const tdb = new TenantDb(companyId);
  const items = tdb.ref('tender_items');
  const { rows } = await tdb.query<ItemRow>(
    `SELECT * FROM ${items} WHERE id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function create(
  companyId: string,
  tenderId: string,
  data: {
    categoryId?: string | null;
    rowNo?: number;
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
     RETURNING *`,
    [
      tenderId,
      data.categoryId ?? null,
      data.rowNo ?? 1,
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
     RETURNING *`,
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

export async function reorder(
  companyId: string,
  items: { id: string; orderNo: number }[],
): Promise<void> {
  const tdb = new TenantDb(companyId);
  const table = tdb.ref('tender_items');
  for (const item of items) {
    await tdb.query(
      `UPDATE ${table} SET order_no = $1, updated_at = NOW() WHERE id = $2`,
      [item.orderNo, item.id],
    );
  }
}

export async function syncItems(
  companyId: string,
  tenderId: string,
  items: { id?: string; description: string; unit: string; quantity: number; location?: string }[],
): Promise<void> {
  const tdb = new TenantDb(companyId);
  const table = tdb.ref('tender_items');

  // Get existing item IDs for this tender
  const { rows: existingRows } = await tdb.query<{ id: string }>(
    `SELECT id FROM ${table} WHERE tender_id = $1`,
    [tenderId],
  );
  const existingIds = new Set(existingRows.map((r) => r.id));

  // Determine which IDs to keep
  const incomingIds = new Set(items.filter((i) => i.id).map((i) => i.id as string));

  // Delete items not in incoming list
  const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));
  if (toDelete.length > 0) {
    const placeholders = toDelete.map((_, i) => `$${i + 1}`).join(', ');
    await tdb.query(`DELETE FROM ${table} WHERE id IN (${placeholders})`, toDelete);
  }

  // Upsert each item
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const rowNo = i + 1;
    if (item.id && existingIds.has(item.id)) {
      // UPDATE
      await tdb.query(
        `UPDATE ${table}
         SET row_no = $1, description = $2, unit = $3, quantity = $4, location = $5, updated_at = NOW()
         WHERE id = $6`,
        [rowNo, item.description, item.unit, item.quantity, item.location ?? null, item.id],
      );
    } else {
      // INSERT
      await tdb.query(
        `INSERT INTO ${table} (tender_id, row_no, description, unit, quantity, location)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenderId, rowNo, item.description, item.unit, item.quantity, item.location ?? null],
      );
    }
  }
}
