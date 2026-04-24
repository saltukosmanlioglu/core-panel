import { TenantDb } from '../../lib/tenantDb';
import type { ComparisonResult } from '../../models/tender-comparison.model';

interface TenderComparisonRow {
  id: string;
  tender_id: string;
  status: string;
  result_json: ComparisonResult | null;
  error_message: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: TenderComparisonRow) {
  return {
    id: row.id,
    tenderId: row.tender_id,
    status: row.status,
    resultJson: row.result_json,
    errorMessage: row.error_message,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type TenderComparisonRecord = ReturnType<typeof mapRow>;

export async function findLatestByTenderId(tdb: TenantDb, tenderId: string): Promise<TenderComparisonRecord | null> {
  const { rows } = await tdb.query<TenderComparisonRow>(
    `SELECT *
     FROM ${tdb.ref('tender_comparisons')}
     WHERE tender_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [tenderId],
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

export async function create(tdb: TenantDb, tenderId: string, createdBy: string): Promise<TenderComparisonRecord> {
  const { rows } = await tdb.query<TenderComparisonRow>(
    `INSERT INTO ${tdb.ref('tender_comparisons')} (tender_id, created_by)
     VALUES ($1, $2)
     RETURNING *`,
    [tenderId, createdBy],
  );

  return mapRow(rows[0]!);
}

export async function updateResult(
  tdb: TenantDb,
  id: string,
  resultJson: ComparisonResult,
): Promise<TenderComparisonRecord | null> {
  const { rows } = await tdb.query<TenderComparisonRow>(
    `UPDATE ${tdb.ref('tender_comparisons')}
     SET status = 'completed', result_json = $2, error_message = NULL, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, JSON.stringify(resultJson)],
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

export async function updateError(
  tdb: TenantDb,
  id: string,
  errorMessage: string,
): Promise<TenderComparisonRecord | null> {
  const { rows } = await tdb.query<TenderComparisonRow>(
    `UPDATE ${tdb.ref('tender_comparisons')}
     SET status = 'failed', error_message = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, errorMessage],
  );

  return rows[0] ? mapRow(rows[0]) : null;
}
