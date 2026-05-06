import { TenantDb } from '../../lib/tenantDb';
import * as companiesRepo from '../companies/companies.repo';
import type { CreateCategoryRequest, UpdateCategoryRequest } from '../../models/category.model';

interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CategoryRecord {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapRow(row: CategoryRow, companyId: string): CategoryRecord {
  return {
    id: row.id,
    companyId,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const findAll = async (companyId: string): Promise<CategoryRecord[]> => {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<CategoryRow>(
    `SELECT * FROM ${tdb.ref('categories')} ORDER BY name ASC`,
  );
  return rows.map((row) => mapRow(row, companyId));
};

export const findById = async (id: string, companyId?: string): Promise<CategoryRecord | null> => {
  if (companyId) return findByIdByCompanyId(companyId, id);

  const companies = await companiesRepo.findAll();
  for (const company of companies) {
    const category = await findByIdByCompanyId(company.id, id);
    if (category) return category;
  }
  return null;
};

export const findByIdByCompanyId = async (companyId: string, id: string): Promise<CategoryRecord | null> => {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<CategoryRow>(
    `SELECT * FROM ${tdb.ref('categories')} WHERE id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] ? mapRow(rows[0], companyId) : null;
};

export const create = async (
  companyId: string,
  data: CreateCategoryRequest,
): Promise<CategoryRecord> => {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<CategoryRow>(
    `INSERT INTO ${tdb.ref('categories')} (name)
     VALUES ($1)
     RETURNING *`,
    [data.name],
  );
  return mapRow(rows[0]!, companyId);
};

export const update = async (
  id: string,
  data: UpdateCategoryRequest,
  companyId?: string,
): Promise<CategoryRecord | null> => {
  const existing = companyId ? await findByIdByCompanyId(companyId, id) : await findById(id);
  if (!existing) return null;

  const tdb = new TenantDb(existing.companyId);
  const setClauses: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];

  if (data.name !== undefined) { params.push(data.name); setClauses.push(`name = $${params.length}`); }

  params.push(id);
  const { rows } = await tdb.query<CategoryRow>(
    `UPDATE ${tdb.ref('categories')}
     SET ${setClauses.join(', ')}
     WHERE id = $${params.length}
     RETURNING *`,
    params,
  );
  return rows[0] ? mapRow(rows[0], existing.companyId) : null;
};

export const remove = async (id: string, companyId?: string): Promise<boolean> => {
  const existing = companyId ? await findByIdByCompanyId(companyId, id) : await findById(id);
  if (!existing) return false;

  const tdb = new TenantDb(existing.companyId);
  const { rowCount } = await tdb.query(
    `DELETE FROM ${tdb.ref('categories')} WHERE id = $1`,
    [id],
  );
  return rowCount > 0;
};

export const findCategoriesByTenantId = async (companyId: string, tenantId: string): Promise<string[]> => {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<{ category_id: string }>(
    `SELECT category_id FROM ${tdb.ref('tenant_categories')} WHERE tenant_id = $1`,
    [tenantId],
  );
  return rows.map((row) => row.category_id);
};

export const findTenantsByCategory = async (companyId: string, categoryId: string): Promise<string[]> => {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<{ tenant_id: string }>(
    `SELECT tenant_id FROM ${tdb.ref('tenant_categories')} WHERE category_id = $1`,
    [categoryId],
  );
  return rows.map((row) => row.tenant_id);
};

export const replaceTenantCategories = async (
  companyId: string,
  tenantId: string,
  categoryIds: string[],
): Promise<void> => {
  const tdb = new TenantDb(companyId);
  await tdb.query(`DELETE FROM ${tdb.ref('tenant_categories')} WHERE tenant_id = $1`, [tenantId]);

  for (const categoryId of categoryIds) {
    await tdb.query(
      `INSERT INTO ${tdb.ref('tenant_categories')} (tenant_id, category_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [tenantId, categoryId],
    );
  }
};

export const findCategoriesBySupplierId = async (companyId: string, supplierId: string): Promise<string[]> => {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<{ category_id: string }>(
    `SELECT category_id FROM ${tdb.ref('material_supplier_categories')} WHERE supplier_id = $1`,
    [supplierId],
  );
  return rows.map((row) => row.category_id);
};

export const findCategoriesByTenantIds = async (companyId: string, tenantIds: string[]): Promise<Record<string, string[]>> => {
  if (tenantIds.length === 0) return {};

  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<{ tenant_id: string; category_id: string }>(
    `SELECT tenant_id, category_id
     FROM ${tdb.ref('tenant_categories')}
     WHERE tenant_id = ANY($1::uuid[])`,
    [tenantIds],
  );

  const map: Record<string, string[]> = {};
  for (const row of rows) {
    if (!map[row.tenant_id]) map[row.tenant_id] = [];
    map[row.tenant_id]!.push(row.category_id);
  }
  return map;
};

export const findCategoriesBySupplierIds = async (companyId: string, supplierIds: string[]): Promise<Record<string, string[]>> => {
  if (supplierIds.length === 0) return {};

  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<{ supplier_id: string; category_id: string }>(
    `SELECT supplier_id, category_id
     FROM ${tdb.ref('material_supplier_categories')}
     WHERE supplier_id = ANY($1::uuid[])`,
    [supplierIds],
  );

  const map: Record<string, string[]> = {};
  for (const row of rows) {
    if (!map[row.supplier_id]) map[row.supplier_id] = [];
    map[row.supplier_id]!.push(row.category_id);
  }
  return map;
};

export const replaceSupplierCategories = async (
  companyId: string,
  supplierId: string,
  categoryIds: string[],
): Promise<void> => {
  const tdb = new TenantDb(companyId);
  await tdb.query(
    `DELETE FROM ${tdb.ref('material_supplier_categories')} WHERE supplier_id = $1`,
    [supplierId],
  );

  for (const categoryId of categoryIds) {
    await tdb.query(
      `INSERT INTO ${tdb.ref('material_supplier_categories')} (supplier_id, category_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [supplierId, categoryId],
    );
  }
};
