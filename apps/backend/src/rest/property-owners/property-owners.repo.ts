import { TenantDb } from '../../lib/tenantDb';
import type { BulkPropertyOwnerInput, CreatePropertyOwnerInput, UpdatePropertyOwnerInput } from '../../models/property-owner.model';

interface PropertyOwnerRow {
  id: string;
  project_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  floor_number: number | null;
  apartment_number: string | null;
  apartment_size_sqm: string | number | null;
  share_percentage: string | number | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

function mapRow(row: PropertyOwnerRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    floorNumber: row.floor_number,
    apartmentNumber: row.apartment_number,
    apartmentSizeSqm: toNumber(row.apartment_size_sqm),
    sharePercentage: toNumber(row.share_percentage),
    idNumber: null,
    apartmentCount: 1,
    note: row.notes,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type PropertyOwnerRecord = ReturnType<typeof mapRow>;

export async function findByProjectId(tdb: TenantDb, projectId: string): Promise<PropertyOwnerRecord[]> {
  const { rows } = await tdb.query<PropertyOwnerRow>(
    `SELECT * FROM ${tdb.ref('property_owners')}
     WHERE project_id = $1
     ORDER BY floor_number ASC NULLS LAST, apartment_number ASC NULLS LAST, name ASC`,
    [projectId],
  );
  return rows.map(mapRow);
}

export async function findById(tdb: TenantDb, id: string): Promise<PropertyOwnerRecord | null> {
  const { rows } = await tdb.query<PropertyOwnerRow>(
    `SELECT * FROM ${tdb.ref('property_owners')} WHERE id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function create(
  tdb: TenantDb,
  projectId: string,
  data: CreatePropertyOwnerInput,
): Promise<PropertyOwnerRecord> {
  const { rows } = await tdb.query<PropertyOwnerRow>(
    `INSERT INTO ${tdb.ref('property_owners')}
       (project_id, name, phone, email, floor_number, apartment_number, apartment_size_sqm, share_percentage, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      projectId,
      data.name,
      data.phone ?? null,
      data.email || null,
      data.floorNumber ?? null,
      data.apartmentNumber ?? null,
      data.apartmentSizeSqm ?? null,
      data.sharePercentage ?? null,
      data.note ?? data.notes ?? null,
    ],
  );
  return mapRow(rows[0]!);
}

export async function update(
  tdb: TenantDb,
  id: string,
  data: UpdatePropertyOwnerInput,
): Promise<PropertyOwnerRecord | null> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];

  if (data.name !== undefined) { params.push(data.name); setClauses.push(`name = $${params.length}`); }
  if (data.phone !== undefined) { params.push(data.phone || null); setClauses.push(`phone = $${params.length}`); }
  if (data.email !== undefined) { params.push(data.email || null); setClauses.push(`email = $${params.length}`); }
  if (data.floorNumber !== undefined) { params.push(data.floorNumber ?? null); setClauses.push(`floor_number = $${params.length}`); }
  if (data.apartmentNumber !== undefined) { params.push(data.apartmentNumber || null); setClauses.push(`apartment_number = $${params.length}`); }
  if (data.apartmentSizeSqm !== undefined) { params.push(data.apartmentSizeSqm ?? null); setClauses.push(`apartment_size_sqm = $${params.length}`); }
  if (data.sharePercentage !== undefined) { params.push(data.sharePercentage ?? null); setClauses.push(`share_percentage = $${params.length}`); }
  if (data.note !== undefined || data.notes !== undefined) {
    params.push(data.note ?? data.notes ?? null);
    setClauses.push(`notes = $${params.length}`);
  }

  if (params.length === 0) return findById(tdb, id);

  params.push(id);
  const { rows } = await tdb.query<PropertyOwnerRow>(
    `UPDATE ${tdb.ref('property_owners')}
     SET ${setClauses.join(', ')}
     WHERE id = $${params.length}
     RETURNING *`,
    params,
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function bulkUpsert(
  tdb: TenantDb,
  projectId: string,
  owners: BulkPropertyOwnerInput[],
): Promise<PropertyOwnerRecord[]> {
  if (owners.length === 0) {
    return [];
  }

  const values: string[] = [];
  const params: unknown[] = [];

  owners.forEach((owner) => {
    const offset = params.length;
    values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`);
    params.push(
      projectId,
      owner.name,
      owner.floor_number ?? null,
      owner.apartment_number ?? null,
      owner.apartment_size_sqm ?? null,
      owner.notes ?? null,
    );
  });

  const { rows } = await tdb.query<PropertyOwnerRow>(
    `INSERT INTO ${tdb.ref('property_owners')}
       (project_id, name, floor_number, apartment_number, apartment_size_sqm, notes)
     VALUES ${values.join(', ')}
     ON CONFLICT (project_id, floor_number, apartment_number)
     DO UPDATE SET
       name = EXCLUDED.name,
       apartment_size_sqm = EXCLUDED.apartment_size_sqm,
       notes = EXCLUDED.notes,
       updated_at = NOW()
     RETURNING *`,
    params,
  );

  return rows.map(mapRow);
}

export async function remove(tdb: TenantDb, id: string): Promise<PropertyOwnerRecord | null> {
  const { rows } = await tdb.query<PropertyOwnerRow>(
    `DELETE FROM ${tdb.ref('property_owners')} WHERE id = $1 RETURNING *`,
    [id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}
