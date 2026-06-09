import { count, eq } from 'drizzle-orm';
import { db, pool } from '../../db/connection';
import { companies, users } from '../../db/schema';
import { TenantDb } from '../../lib/tenantDb';
import { getTenantSchemaName } from '../../services/schemaService';

export async function getCounts(): Promise<{
  companies: number;
  tenants: number;
  users: number;
}> {
  const [[companiesCount], [usersCount], companyRows] = await Promise.all([
    db.select({ count: count() }).from(companies),
    db.select({ count: count() }).from(users),
    db.select({ id: companies.id }).from(companies),
  ]);

  let tenants = 0;
  if (companyRows.length > 0) {
    // Build a single UNION ALL query across all tenant schemas to avoid N+1
    const unionSql = companyRows
      .map((c) => `SELECT COUNT(*)::int AS cnt FROM "${getTenantSchemaName(c.id)}".tenants`)
      .join(' UNION ALL ');
    const { rows } = await pool.query<{ total: number }>(`SELECT SUM(cnt)::int AS total FROM (${unionSql}) t`);
    tenants = Number(rows[0]?.total ?? 0);
  }

  return {
    companies: Number(companiesCount?.count ?? 0),
    tenants,
    users: Number(usersCount?.count ?? 0),
  };
}

export async function getCountsByCompany(companyId: string): Promise<{
  tenants: number;
  materialSupplierCount: number;
  projectCount: number;
  tenderCount: number;
  users: number;
}> {
  const tdb = new TenantDb(companyId);
  const [tenantsResult, materialSuppliersResult, usersResult, projectsResult, tendersResult] = await Promise.all([
    tdb.query<{ count: string }>(`SELECT COUNT(*) AS count FROM ${tdb.ref('tenants')}`),
    tdb.query<{ count: string }>(`SELECT COUNT(*) AS count FROM ${tdb.ref('material_suppliers')}`),
    db.select({ count: count() }).from(users).where(eq(users.companyId, companyId)),
    tdb.query<{ count: string }>(`SELECT COUNT(*) AS count FROM ${tdb.ref('projects')}`),
    tdb.query<{ count: string }>(`SELECT COUNT(*) AS count FROM ${tdb.ref('tenders')}`),
  ]);

  return {
    tenants: Number(tenantsResult.rows[0]?.count ?? 0),
    materialSupplierCount: Number(materialSuppliersResult.rows[0]?.count ?? 0),
    projectCount: Number(projectsResult.rows[0]?.count ?? 0),
    tenderCount: Number(tendersResult.rows[0]?.count ?? 0),
    users: Number(usersResult[0]?.count ?? 0),
  };
}
