import { count, countDistinct, eq, or } from 'drizzle-orm';
import { db } from '../../db/connection';
import { companies, tenants, users } from '../../db/schema';

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
  users: number;
}> {
  const [tenantsResult, usersResult] = await Promise.all([
    db.select({ count: count() }).from(tenants).where(eq(tenants.companyId, companyId)),
    db
      .select({ count: countDistinct(users.id) })
      .from(users)
      .leftJoin(tenants, eq(users.tenantId, tenants.id))
      .where(or(eq(users.companyId, companyId), eq(tenants.companyId, companyId))),
  ]);

  return {
    tenants: Number(tenantsResult[0]?.count ?? 0),
    users: Number(usersResult[0]?.count ?? 0),
  };
}
