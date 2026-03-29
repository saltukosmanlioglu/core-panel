import { TenantDb } from '../../lib/tenantDb';

interface CategoryRow {
  id: string;
  tender_id: string;
  name: string;
  order_no: number;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: CategoryRow) {
  return {
    id: row.id,
    tenderId: row.tender_id,
    name: row.name,
    orderNo: row.order_no,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type CategoryRecord = ReturnType<typeof mapRow>;

export async function findByTenderId(companyId: string, tenderId: string): Promise<CategoryRecord[]> {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<CategoryRow>(
    `SELECT * FROM ${tdb.ref('tender_categories')} WHERE tender_id = $1 ORDER BY order_no ASC`,
    [tenderId],
  );
  return rows.map(mapRow);
}

export async function findById(companyId: string, id: string): Promise<CategoryRecord | null> {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<CategoryRow>(
    `SELECT * FROM ${tdb.ref('tender_categories')} WHERE id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function create(
  companyId: string,
  tenderId: string,
  data: { name: string; orderNo?: number },
): Promise<CategoryRecord> {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<CategoryRow>(
    `INSERT INTO ${tdb.ref('tender_categories')} (tender_id, name, order_no)
     VALUES ($1, $2, $3) RETURNING *`,
    [tenderId, data.name, data.orderNo ?? 0],
  );
  return mapRow(rows[0]!);
}

export async function update(
  companyId: string,
  id: string,
  data: { name?: string; orderNo?: number },
): Promise<CategoryRecord | null> {
  const tdb = new TenantDb(companyId);
  const setClauses: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];

  if (data.name !== undefined) { params.push(data.name); setClauses.push(`name = $${params.length}`); }
  if (data.orderNo !== undefined) { params.push(data.orderNo); setClauses.push(`order_no = $${params.length}`); }

  params.push(id);
  const { rows } = await tdb.query<CategoryRow>(
    `UPDATE ${tdb.ref('tender_categories')} SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params,
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function remove(companyId: string, id: string): Promise<boolean> {
  const tdb = new TenantDb(companyId);
  const { rowCount } = await tdb.query(
    `DELETE FROM ${tdb.ref('tender_categories')} WHERE id = $1`,
    [id],
  );
  return rowCount > 0;
}
