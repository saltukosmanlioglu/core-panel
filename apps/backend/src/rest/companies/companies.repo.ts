import { eq } from 'drizzle-orm';
import { db } from '../../db/connection';
import { companies } from '../../db/schema';
import type { Company } from '../../db/schema';

export async function findAll(): Promise<Company[]> {
  return db.select().from(companies).orderBy(companies.createdAt);
}

export async function findById(id: string): Promise<Company | null> {
  const result = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return result[0] ?? null;
}

export async function create(data: { name: string }): Promise<Company> {
  const [company] = await db.insert(companies).values({ name: data.name }).returning();
  return company!;
}

export async function update(id: string, data: { name: string }): Promise<Company | null> {
  const [updated] = await db
    .update(companies)
    .set({ name: data.name, updatedAt: new Date() })
    .where(eq(companies.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteById(id: string): Promise<boolean> {
  const deleted = await db.delete(companies).where(eq(companies.id, id)).returning();
  return deleted.length > 0;
}
