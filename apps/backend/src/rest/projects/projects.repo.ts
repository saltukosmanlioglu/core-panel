import { eq } from 'drizzle-orm';
import { db } from '../../db/connection';
import { projects } from '../../db/schema';
import type { Project } from '../../db/schema';

export async function findAll(): Promise<Project[]> {
  return db.select().from(projects).orderBy(projects.createdAt);
}

export async function findById(id: string): Promise<Project | null> {
  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return result[0] ?? null;
}

export async function create(data: { name: string; description?: string; status?: string }): Promise<Project> {
  const [project] = await db
    .insert(projects)
    .values({ name: data.name, description: data.description, status: data.status ?? 'active' })
    .returning();
  return project!;
}

export async function update(id: string, data: { name?: string; description?: string; status?: string }): Promise<Project | null> {
  const [updated] = await db
    .update(projects)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteById(id: string): Promise<boolean> {
  const deleted = await db.delete(projects).where(eq(projects.id, id)).returning();
  return deleted.length > 0;
}
