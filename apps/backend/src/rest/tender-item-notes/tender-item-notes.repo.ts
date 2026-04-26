import { TenantDb } from '../../lib/tenantDb';

interface TenderItemNoteRow {
  id: string;
  tender_id: string;
  sira_no: number;
  note: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: TenderItemNoteRow) {
  return {
    id: row.id,
    tenderId: row.tender_id,
    siraNo: row.sira_no,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type TenderItemNoteRecord = ReturnType<typeof mapRow>;

export async function findByTenderId(tdb: TenantDb, tenderId: string): Promise<Array<Pick<TenderItemNoteRecord, 'siraNo' | 'note'>>> {
  const { rows } = await tdb.query<TenderItemNoteRow>(
    `SELECT *
     FROM ${tdb.ref('tender_item_notes')}
     WHERE tender_id = $1
     ORDER BY sira_no ASC`,
    [tenderId],
  );

  return rows.map((row) => ({
    siraNo: row.sira_no,
    note: row.note,
  }));
}

export async function upsert(
  tdb: TenantDb,
  tenderId: string,
  siraNo: number,
  note: string,
  createdBy: string,
): Promise<TenderItemNoteRecord> {
  const { rows } = await tdb.query<TenderItemNoteRow>(
    `INSERT INTO ${tdb.ref('tender_item_notes')} (tender_id, sira_no, note, created_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tender_id, sira_no)
     DO UPDATE SET
       note = EXCLUDED.note,
       created_by = EXCLUDED.created_by,
       updated_at = NOW()
     RETURNING *`,
    [tenderId, siraNo, note, createdBy],
  );

  return mapRow(rows[0]!);
}

export async function remove(tdb: TenantDb, tenderId: string, siraNo: number): Promise<boolean> {
  const { rowCount } = await tdb.query(
    `DELETE FROM ${tdb.ref('tender_item_notes')}
     WHERE tender_id = $1 AND sira_no = $2`,
    [tenderId, siraNo],
  );

  return rowCount > 0;
}
