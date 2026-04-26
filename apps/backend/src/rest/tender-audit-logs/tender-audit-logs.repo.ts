import { TenantDb } from '../../lib/tenantDb';

interface TenderAuditLogRow {
  id: string;
  tender_id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_by: string;
  created_at: Date;
  created_by_name: string | null;
}

function mapRow(row: TenderAuditLogRow) {
  return {
    id: row.id,
    tenderId: row.tender_id,
    action: row.action,
    details: row.details,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
  };
}

export type TenderAuditLogRecord = ReturnType<typeof mapRow>;

export async function findByTenderId(tdb: TenantDb, tenderId: string): Promise<TenderAuditLogRecord[]> {
  const { rows } = await tdb.query<TenderAuditLogRow>(
    `SELECT logs.*, users.name AS created_by_name
     FROM ${tdb.ref('tender_audit_logs')} logs
     LEFT JOIN "public"."users" users ON users.id = logs.created_by
     WHERE logs.tender_id = $1
     ORDER BY logs.created_at DESC`,
    [tenderId],
  );

  return rows.map(mapRow);
}

export async function create(
  tdb: TenantDb,
  tenderId: string,
  action: string,
  details: Record<string, unknown> | null,
  userId: string,
): Promise<TenderAuditLogRecord> {
  const { rows } = await tdb.query<TenderAuditLogRow>(
    `INSERT INTO ${tdb.ref('tender_audit_logs')} (tender_id, action, details, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *, NULL::text AS created_by_name`,
    [tenderId, action, details, userId],
  );

  return mapRow(rows[0]!);
}
