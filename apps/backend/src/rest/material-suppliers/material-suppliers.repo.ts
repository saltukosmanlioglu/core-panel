import { TenantDb } from '../../lib/tenantDb';
import type {
  CreateMaterialSupplierRequest,
  UpdateMaterialSupplierRequest,
} from '../../models/material-supplier.model';

interface MaterialSupplierRow {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface MaterialSupplierRecord {
  id: string;
  companyId: string;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  email: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapRow(row: MaterialSupplierRow, companyId: string): MaterialSupplierRecord {
  return {
    id: row.id,
    companyId,
    name: row.name,
    contactName: row.contact_person,
    contactPhone: row.phone,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findAll(companyId: string): Promise<MaterialSupplierRecord[]> {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<MaterialSupplierRow>(
    `SELECT * FROM ${tdb.ref('material_suppliers')} ORDER BY name ASC`,
  );
  return rows.map((row) => mapRow(row, companyId));
}

export async function findByIdByCompanyId(companyId: string, id: string): Promise<MaterialSupplierRecord | null> {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<MaterialSupplierRow>(
    `SELECT * FROM ${tdb.ref('material_suppliers')} WHERE id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] ? mapRow(rows[0], companyId) : null;
}

export async function create(
  companyId: string,
  data: CreateMaterialSupplierRequest,
): Promise<MaterialSupplierRecord> {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<MaterialSupplierRow>(
    `INSERT INTO ${tdb.ref('material_suppliers')} (name, contact_person, phone)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [data.name, data.contactName ?? null, data.contactPhone ?? null],
  );
  return mapRow(rows[0]!, companyId);
}

export async function update(
  companyId: string,
  id: string,
  data: UpdateMaterialSupplierRequest,
): Promise<MaterialSupplierRecord | null> {
  const tdb = new TenantDb(companyId);
  const setClauses: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];

  if (data.name !== undefined) { params.push(data.name); setClauses.push(`name = $${params.length}`); }
  if (data.contactName !== undefined) { params.push(data.contactName); setClauses.push(`contact_person = $${params.length}`); }
  if (data.contactPhone !== undefined) { params.push(data.contactPhone); setClauses.push(`phone = $${params.length}`); }

  params.push(id);
  const { rows } = await tdb.query<MaterialSupplierRow>(
    `UPDATE ${tdb.ref('material_suppliers')}
     SET ${setClauses.join(', ')}
     WHERE id = $${params.length}
     RETURNING *`,
    params,
  );
  return rows[0] ? mapRow(rows[0], companyId) : null;
}

export async function remove(companyId: string, id: string): Promise<boolean> {
  const tdb = new TenantDb(companyId);
  const { rowCount } = await tdb.query(
    `DELETE FROM ${tdb.ref('material_suppliers')} WHERE id = $1`,
    [id],
  );
  return rowCount > 0;
}
