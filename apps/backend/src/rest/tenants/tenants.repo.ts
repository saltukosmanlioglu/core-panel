import { TenantDb } from '../../lib/tenantDb';
import * as companiesRepo from '../companies/companies.repo';

interface TenantRow {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  tax_id: string | null;
  bank_account: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface TenantRecord {
  id: string;
  companyId: string;
  companyName: string | null;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  email: string | null;
  taxId: string | null;
  bankAccount: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapRow(row: TenantRow, companyId: string, companyName: string | null = null): TenantRecord {
  return {
    id: row.id,
    companyId,
    companyName,
    name: row.name,
    contactName: row.contact_name,
    contactPhone: row.phone,
    email: row.email,
    taxId: row.tax_id,
    bankAccount: row.bank_account,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findAll(): Promise<TenantRecord[]> {
  const companies = await companiesRepo.findAll();
  const results = await Promise.all(companies.map((company) => findAllByCompanyId(company.id, company.name)));
  return results.flat();
}

export async function findById(id: string): Promise<TenantRecord | null> {
  const companies = await companiesRepo.findAll();
  for (const company of companies) {
    const tenant = await findByIdByCompanyId(company.id, id, company.name);
    if (tenant) return tenant;
  }
  return null;
}

export async function findByIdByCompanyId(
  companyId: string,
  id: string,
  companyName: string | null = null,
): Promise<TenantRecord | null> {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<TenantRow>(
    `SELECT * FROM ${tdb.ref('tenants')} WHERE id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] ? mapRow(rows[0], companyId, companyName) : null;
}

export async function findAllByCompanyId(companyId: string, companyName: string | null = null): Promise<TenantRecord[]> {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<TenantRow>(
    `SELECT * FROM ${tdb.ref('tenants')} ORDER BY name ASC`,
  );
  return rows.map((row) => mapRow(row, companyId, companyName));
}

export async function create(data: {
  name: string;
  companyId: string;
  contactName?: string;
  contactPhone?: string;
}): Promise<TenantRecord> {
  const tdb = new TenantDb(data.companyId);
  const { rows } = await tdb.query<TenantRow>(
    `INSERT INTO ${tdb.ref('tenants')} (name, contact_name, phone)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [data.name, data.contactName ?? null, data.contactPhone ?? null],
  );
  return mapRow(rows[0]!, data.companyId);
}

export async function update(
  id: string,
  data: { name?: string; companyId?: string; contactName?: string; contactPhone?: string },
): Promise<TenantRecord | null> {
  const companyId = data.companyId;
  const existing = companyId ? await findByIdByCompanyId(companyId, id) : await findById(id);
  if (!existing) return null;

  const tdb = new TenantDb(existing.companyId);
  const setClauses: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];

  if (data.name !== undefined) { params.push(data.name); setClauses.push(`name = $${params.length}`); }
  if (data.contactName !== undefined) { params.push(data.contactName); setClauses.push(`contact_name = $${params.length}`); }
  if (data.contactPhone !== undefined) { params.push(data.contactPhone); setClauses.push(`phone = $${params.length}`); }

  params.push(id);
  const { rows } = await tdb.query<TenantRow>(
    `UPDATE ${tdb.ref('tenants')}
     SET ${setClauses.join(', ')}
     WHERE id = $${params.length}
     RETURNING *`,
    params,
  );
  return rows[0] ? mapRow(rows[0], existing.companyId, existing.companyName) : null;
}

export async function deleteById(id: string): Promise<boolean> {
  const existing = await findById(id);
  if (!existing) return false;

  const tdb = new TenantDb(existing.companyId);
  const { rowCount } = await tdb.query(
    `DELETE FROM ${tdb.ref('tenants')} WHERE id = $1`,
    [id],
  );
  return rowCount > 0;
}
