import { TenantDb } from '../../lib/tenantDb';
import type { TenderItemInput } from '../../models/tender-item.model';

interface TenderItemRow {
  id: string;
  tender_id: string;
  row_no: number;
  pos_no: string | null;
  description: string;
  unit: string;
  quantity: string | number;
  location: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: TenderItemRow) {
  return {
    id: row.id,
    tenderId: row.tender_id,
    rowNo: row.row_no,
    posNo: row.pos_no,
    description: row.description,
    unit: row.unit,
    quantity: Number(row.quantity),
    location: row.location,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type TenderItemRecord = ReturnType<typeof mapRow>;

export const findByTenderId = async (tdb: TenantDb, tenderId: string): Promise<TenderItemRecord[]> => {
  const result = await tdb.query<TenderItemRow>(
    `SELECT * FROM ${tdb.ref('tender_items')} WHERE tender_id = $1 ORDER BY row_no ASC`,
    [tenderId],
  );
  return result.rows.map(mapRow);
};

export const replaceAll = async (
  tdb: TenantDb,
  tenderId: string,
  items: TenderItemInput[],
): Promise<void> => {
  await tdb.query(`DELETE FROM ${tdb.ref('tender_items')} WHERE tender_id = $1`, [tenderId]);

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    await tdb.query(
      `INSERT INTO ${tdb.ref('tender_items')}
       (tender_id, row_no, pos_no, description, unit, quantity, location)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        tenderId,
        index + 1,
        item.posNo ?? null,
        item.description,
        item.unit,
        item.quantity,
        item.location ?? null,
      ],
    );
  }
};
