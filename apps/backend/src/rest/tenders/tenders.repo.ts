import { eq } from 'drizzle-orm';
import { db } from '../../db/connection';
import { tenders, projects } from '../../db/schema';
import type { Tender } from '../../db/schema';

export type TenderWithProject = Tender & { projectName: string | null };

export async function findAll(): Promise<TenderWithProject[]> {
  return db
    .select({
      id: tenders.id,
      projectId: tenders.projectId,
      projectName: projects.name,
      title: tenders.title,
      description: tenders.description,
      status: tenders.status,
      budget: tenders.budget,
      deadline: tenders.deadline,
      createdAt: tenders.createdAt,
      updatedAt: tenders.updatedAt,
    })
    .from(tenders)
    .leftJoin(projects, eq(tenders.projectId, projects.id))
    .orderBy(tenders.createdAt);
}

export async function findById(id: string): Promise<TenderWithProject | null> {
  const result = await db
    .select({
      id: tenders.id,
      projectId: tenders.projectId,
      projectName: projects.name,
      title: tenders.title,
      description: tenders.description,
      status: tenders.status,
      budget: tenders.budget,
      deadline: tenders.deadline,
      createdAt: tenders.createdAt,
      updatedAt: tenders.updatedAt,
    })
    .from(tenders)
    .leftJoin(projects, eq(tenders.projectId, projects.id))
    .where(eq(tenders.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function create(data: {
  projectId: string;
  title: string;
  description?: string;
  status?: string;
  budget?: string;
  deadline?: Date;
}): Promise<Tender> {
  const [tender] = await db
    .insert(tenders)
    .values({
      projectId: data.projectId,
      title: data.title,
      description: data.description,
      status: data.status ?? 'draft',
      budget: data.budget,
      deadline: data.deadline,
    })
    .returning();
  return tender!;
}

export async function update(
  id: string,
  data: {
    projectId?: string;
    title?: string;
    description?: string;
    status?: string;
    budget?: string;
    deadline?: Date | null;
  }
): Promise<Tender | null> {
  const [updated] = await db
    .update(tenders)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tenders.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteById(id: string): Promise<boolean> {
  const deleted = await db.delete(tenders).where(eq(tenders.id, id)).returning();
  return deleted.length > 0;
}
