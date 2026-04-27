import { eq } from 'drizzle-orm';
import { db } from '../../db/connection';
import { tenants, companies } from '../../db/schema';
import type { Tenant } from '../../db/schema';

export type TenantWithCompany = Tenant & { companyName: string | null };

export async function findAll(): Promise<TenantWithCompany[]> {
  return db
    .select({
      id: tenants.id,
      name: tenants.name,
      contactName: tenants.contactName,
      contactPhone: tenants.contactPhone,
      companyId: tenants.companyId,
      companyName: companies.name,
      createdAt: tenants.createdAt,
      updatedAt: tenants.updatedAt,
    })
    .from(tenants)
    .leftJoin(companies, eq(tenants.companyId, companies.id))
    .orderBy(tenants.createdAt);
}

export async function findById(id: string): Promise<TenantWithCompany | null> {
  const result = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      contactName: tenants.contactName,
      contactPhone: tenants.contactPhone,
      companyId: tenants.companyId,
      companyName: companies.name,
      createdAt: tenants.createdAt,
      updatedAt: tenants.updatedAt,
    })
    .from(tenants)
    .leftJoin(companies, eq(tenants.companyId, companies.id))
    .where(eq(tenants.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function findAllByCompanyId(companyId: string): Promise<TenantWithCompany[]> {
  return db
    .select({
      id: tenants.id,
      name: tenants.name,
      contactName: tenants.contactName,
      contactPhone: tenants.contactPhone,
      companyId: tenants.companyId,
      companyName: companies.name,
      createdAt: tenants.createdAt,
      updatedAt: tenants.updatedAt,
    })
    .from(tenants)
    .leftJoin(companies, eq(tenants.companyId, companies.id))
    .where(eq(tenants.companyId, companyId))
    .orderBy(tenants.createdAt);
}

export async function create(data: {
  name: string;
  companyId: string;
  contactName?: string;
  contactPhone?: string;
}): Promise<Tenant> {
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: data.name,
      companyId: data.companyId,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
    })
    .returning();
  return tenant!;
}

export async function update(
  id: string,
  data: { name?: string; companyId?: string; contactName?: string; contactPhone?: string }
): Promise<Tenant | null> {
  const [updated] = await db
    .update(tenants)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tenants.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteById(id: string): Promise<boolean> {
  const deleted = await db.delete(tenants).where(eq(tenants.id, id)).returning();
  return deleted.length > 0;
}
