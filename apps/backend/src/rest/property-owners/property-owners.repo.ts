import { TenantDb } from '../../lib/tenantDb';
import type { CreatePropertyOwnerInput, UpdatePropertyOwnerInput } from '../../models/property-owner.model';

interface PropertyOwnerRow {
  id: string;
  project_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  id_number: string | null;
  floor_number: number | null;
  apartment_number: string | null;
  apartment_size_sqm: string | number | null;
  share_percentage: string | number | null;
  apartment_count: number | null;
  note: string | null;
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
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    idNumber: row.id_number,
    floorNumber: row.floor_number,
    apartmentNumber: row.apartment_number,
    apartmentSizeSqm: toNumber(row.apartment_size_sqm),
    sharePercentage: toNumber(row.share_percentage),
    apartmentCount: row.apartment_count ?? 1,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type PropertyOwnerRecord = ReturnType<typeof mapRow>;

export async function findByProjectId(tdb: TenantDb, projectId: string): Promise<PropertyOwnerRecord[]> {
  const { rows } = await tdb.query<PropertyOwnerRow>(
    `SELECT * FROM ${tdb.ref('property_owners')}
     WHERE project_id = $1
     ORDER BY floor_number ASC NULLS LAST, apartment_number ASC NULLS LAST, full_name ASC`,
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
       (project_id, full_name, phone, email, id_number, floor_number, apartment_number, apartment_size_sqm, share_percentage, apartment_count, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      projectId,
      data.fullName,
      data.phone ?? null,
      data.email || null,
      data.idNumber ?? null,
      data.floorNumber ?? null,
      data.apartmentNumber ?? null,
      data.apartmentSizeSqm ?? null,
      data.sharePercentage ?? null,
      data.apartmentCount,
      data.note ?? null,
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

  if (data.fullName !== undefined) { params.push(data.fullName); setClauses.push(`full_name = $${params.length}`); }
  if (data.phone !== undefined) { params.push(data.phone || null); setClauses.push(`phone = $${params.length}`); }
  if (data.email !== undefined) { params.push(data.email || null); setClauses.push(`email = $${params.length}`); }
  if (data.idNumber !== undefined) { params.push(data.idNumber || null); setClauses.push(`id_number = $${params.length}`); }
  if (data.floorNumber !== undefined) { params.push(data.floorNumber ?? null); setClauses.push(`floor_number = $${params.length}`); }
  if (data.apartmentNumber !== undefined) { params.push(data.apartmentNumber || null); setClauses.push(`apartment_number = $${params.length}`); }
  if (data.apartmentSizeSqm !== undefined) { params.push(data.apartmentSizeSqm ?? null); setClauses.push(`apartment_size_sqm = $${params.length}`); }
  if (data.sharePercentage !== undefined) { params.push(data.sharePercentage ?? null); setClauses.push(`share_percentage = $${params.length}`); }
  if (data.apartmentCount !== undefined) { params.push(data.apartmentCount); setClauses.push(`apartment_count = $${params.length}`); }
  if (data.note !== undefined) { params.push(data.note || null); setClauses.push(`note = $${params.length}`); }

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

export async function remove(tdb: TenantDb, id: string): Promise<PropertyOwnerRecord | null> {
  const { rows } = await tdb.query<PropertyOwnerRow>(
    `DELETE FROM ${tdb.ref('property_owners')} WHERE id = $1 RETURNING *`,
    [id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}
