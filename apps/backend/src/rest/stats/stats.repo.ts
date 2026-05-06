import { count, eq } from 'drizzle-orm';
import { db } from '../../db/connection';
import { companies, users } from '../../db/schema';
import { TenantDb } from '../../lib/tenantDb';

export async function getCounts(): Promise<{
  companies: number;
  tenants: number;
  users: number;
}> {
  const [[companiesCount], [usersCount]] = await Promise.all([
    db.select({ count: count() }).from(companies),
    db.select({ count: count() }).from(users),
  ]);
  const companyRows = await db.select({ id: companies.id }).from(companies);
  const tenantCounts = await Promise.all(
    companyRows.map((company) => {
      const tdb = new TenantDb(company.id);
      return tdb.query<{ count: string }>(`SELECT COUNT(*) AS count FROM ${tdb.ref('tenants')}`);
    }),
  );

  return {
    companies: Number(companiesCount?.count ?? 0),
    tenants: tenantCounts.reduce((sum, result) => sum + Number(result.rows[0]?.count ?? 0), 0),
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
