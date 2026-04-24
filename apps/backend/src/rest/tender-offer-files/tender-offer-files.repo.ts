import { TenantDb } from '../../lib/tenantDb';

interface TenderOfferFileRow {
  id: string;
  tender_id: string;
  tenant_id: string;
  original_name: string;
  stored_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: Date;
  updated_at: Date;
  tenant_name?: string | null;
}

function mapRow(row: TenderOfferFileRow) {
  return {
    id: row.id,
    tenderId: row.tender_id,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name ?? null,
    originalName: row.original_name,
    storedName: row.stored_name,
    filePath: row.file_path,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size),
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type TenderOfferFileRecord = ReturnType<typeof mapRow>;

const SELECT_COLUMNS = `
  tof.*,
  tenants.name AS tenant_name
`;

export async function findByTenderId(tdb: TenantDb, tenderId: string): Promise<TenderOfferFileRecord[]> {
  const { rows } = await tdb.query<TenderOfferFileRow>(
    `SELECT ${SELECT_COLUMNS}
     FROM ${tdb.ref('tender_offer_files')} tof
     LEFT JOIN "public"."tenants" tenants ON tenants.id = tof.tenant_id
     WHERE tof.tender_id = $1
     ORDER BY tenants.name ASC NULLS LAST, tof.created_at ASC`,
    [tenderId],
  );

  return rows.map(mapRow);
}

export async function findByTenderAndTenant(
  tdb: TenantDb,
  tenderId: string,
  tenantId: string,
): Promise<TenderOfferFileRecord | null> {
  const { rows } = await tdb.query<TenderOfferFileRow>(
    `SELECT ${SELECT_COLUMNS}
     FROM ${tdb.ref('tender_offer_files')} tof
     LEFT JOIN "public"."tenants" tenants ON tenants.id = tof.tenant_id
     WHERE tof.tender_id = $1 AND tof.tenant_id = $2
     LIMIT 1`,
    [tenderId, tenantId],
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

export async function upsert(
  tdb: TenantDb,
  data: {
    tenderId: string;
    tenantId: string;
    originalName: string;
    storedName: string;
    filePath: string;
    mimeType: string;
    fileSize: number;
    uploadedBy: string;
  },
): Promise<TenderOfferFileRecord> {
  const { rows } = await tdb.query<TenderOfferFileRow>(
    `INSERT INTO ${tdb.ref('tender_offer_files')}
       (tender_id, tenant_id, original_name, stored_name, file_path, mime_type, file_size, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (tender_id, tenant_id)
     DO UPDATE SET
       original_name = EXCLUDED.original_name,
       stored_name = EXCLUDED.stored_name,
       file_path = EXCLUDED.file_path,
       mime_type = EXCLUDED.mime_type,
       file_size = EXCLUDED.file_size,
       uploaded_by = EXCLUDED.uploaded_by,
       updated_at = NOW()
     RETURNING *, NULL::text AS tenant_name`,
    [
      data.tenderId,
      data.tenantId,
      data.originalName,
      data.storedName,
      data.filePath,
      data.mimeType,
      data.fileSize,
      data.uploadedBy,
    ],
  );

  return mapRow(rows[0]!);
}

export async function remove(
  tdb: TenantDb,
  tenderId: string,
  tenantId: string,
): Promise<TenderOfferFileRecord | null> {
  const { rows } = await tdb.query<TenderOfferFileRow>(
    `DELETE FROM ${tdb.ref('tender_offer_files')}
     WHERE tender_id = $1 AND tenant_id = $2
     RETURNING *, NULL::text AS tenant_name`,
    [tenderId, tenantId],
  );

  return rows[0] ? mapRow(rows[0]) : null;
}
