import { TenantDb } from '../../lib/tenantDb';

interface TenderOfferFileRow {
  id: string;
  tender_id: string;
  original_name: string;
  stored_name: string;
  file_path: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: Date;
}

function mapRow(row: TenderOfferFileRow) {
  return {
    id: row.id,
    tenderId: row.tender_id,
    originalName: row.original_name,
    storedName: row.stored_name,
    filePath: row.file_path,
    mimeType: row.mime_type,
    fileSize: row.file_size !== null ? Number(row.file_size) : null,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

export type TenderOfferFileRecord = ReturnType<typeof mapRow>;

export async function findByTenderId(tdb: TenantDb, tenderId: string): Promise<TenderOfferFileRecord[]> {
  const { rows } = await tdb.query<TenderOfferFileRow>(
    `SELECT * FROM ${tdb.ref('tender_offer_files')}
     WHERE tender_id = $1
     ORDER BY created_at ASC`,
    [tenderId],
  );
  return rows.map(mapRow);
}

export async function findById(tdb: TenantDb, id: string): Promise<TenderOfferFileRecord | null> {
  const { rows } = await tdb.query<TenderOfferFileRow>(
    `SELECT * FROM ${tdb.ref('tender_offer_files')} WHERE id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function create(
  tdb: TenantDb,
  data: {
    tenderId: string;
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
       (tender_id, original_name, stored_name, file_path, mime_type, file_size, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.tenderId,
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

export async function remove(tdb: TenantDb, fileId: string): Promise<TenderOfferFileRecord | null> {
  const { rows } = await tdb.query<TenderOfferFileRow>(
    `DELETE FROM ${tdb.ref('tender_offer_files')} WHERE id = $1 RETURNING *`,
    [fileId],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}
