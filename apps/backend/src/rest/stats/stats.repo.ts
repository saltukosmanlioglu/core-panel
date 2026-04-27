import { count, countDistinct, eq, or } from 'drizzle-orm';
import { db } from '../../db/connection';
import { companies, materialSuppliers, tenants, users } from '../../db/schema';
import { TenantDb } from '../../lib/tenantDb';

export async function getCounts(): Promise<{
  companies: number;
  tenants: number;
  users: number;
}> {
  const [[companiesCount], [tenantsCount], [usersCount]] = await Promise.all([
    db.select({ count: count() }).from(companies),
    db.select({ count: count() }).from(tenants),
    db.select({ count: count() }).from(users),
  ]);

  return {
    companies: Number(companiesCount?.count ?? 0),
    tenants: Number(tenantsCount?.count ?? 0),
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
    db.select({ count: count() }).from(tenants).where(eq(tenants.companyId, companyId)),
    db.select({ count: count() }).from(materialSuppliers).where(eq(materialSuppliers.companyId, companyId)),
    db
      .select({ count: countDistinct(users.id) })
      .from(users)
      .leftJoin(tenants, eq(users.tenantId, tenants.id))
      .where(or(eq(users.companyId, companyId), eq(tenants.companyId, companyId))),
    tdb.query<{ count: string }>(`SELECT COUNT(*) AS count FROM ${tdb.ref('projects')}`),
    tdb.query<{ count: string }>(`SELECT COUNT(*) AS count FROM ${tdb.ref('tenders')}`),
  ]);

  return {
    tenants: Number(tenantsResult[0]?.count ?? 0),
    materialSupplierCount: Number(materialSuppliersResult[0]?.count ?? 0),
    projectCount: Number(projectsResult.rows[0]?.count ?? 0),
    tenderCount: Number(tendersResult.rows[0]?.count ?? 0),
    users: Number(usersResult[0]?.count ?? 0),
  };
}
