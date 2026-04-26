import { TenantDb } from '../../lib/tenantDb';
import type { UpsertAwardItemRequest } from '../../models/tender-award.model';

interface TenderAwardItemRow {
  id: string;
  tender_id: string;
  sira_no: number;
  description: string | null;
  awarded_tenant_id: string | null;
  status: string;
  note: string | null;
  awarded_by: string;
  awarded_at: Date;
  updated_at: Date;
}

function mapRow(row: TenderAwardItemRow) {
  return {
    id: row.id,
    tenderId: row.tender_id,
    siraNo: row.sira_no,
    description: row.description,
    awardedTenantId: row.awarded_tenant_id,
    status: row.status,
    note: row.note,
    awardedBy: row.awarded_by,
    awardedAt: row.awarded_at,
    updatedAt: row.updated_at,
  };
}

export type TenderAwardItemRecord = ReturnType<typeof mapRow>;

export async function findByTenderId(tdb: TenantDb, tenderId: string): Promise<TenderAwardItemRecord[]> {
  const { rows } = await tdb.query<TenderAwardItemRow>(
    `SELECT *
     FROM ${tdb.ref('tender_award_items')}
     WHERE tender_id = $1
     ORDER BY sira_no ASC`,
    [tenderId],
  );

  return rows.map(mapRow);
}

export async function upsertItem(
  tdb: TenantDb,
  tenderId: string,
  data: UpsertAwardItemRequest,
  userId: string,
): Promise<TenderAwardItemRecord> {
  const { rows } = await tdb.query<TenderAwardItemRow>(
    `INSERT INTO ${tdb.ref('tender_award_items')}
      (tender_id, sira_no, description, awarded_tenant_id, status, note, awarded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (tender_id, sira_no)
     DO UPDATE SET
       description = EXCLUDED.description,
       awarded_tenant_id = EXCLUDED.awarded_tenant_id,
       status = EXCLUDED.status,
       note = EXCLUDED.note,
       awarded_by = EXCLUDED.awarded_by,
       updated_at = NOW()
     RETURNING *`,
    [
      tenderId,
      data.siraNo,
      data.description ?? null,
      data.awardedTenantId,
      data.status,
      data.note ?? null,
      userId,
    ],
  );

  return mapRow(rows[0]!);
}

export async function bulkUpsert(
  tdb: TenantDb,
  tenderId: string,
  items: UpsertAwardItemRequest[],
  userId: string,
): Promise<TenderAwardItemRecord[]> {
  const results: TenderAwardItemRecord[] = [];

  for (const item of items) {
    results.push(await upsertItem(tdb, tenderId, item, userId));
  }

  return results;
}
