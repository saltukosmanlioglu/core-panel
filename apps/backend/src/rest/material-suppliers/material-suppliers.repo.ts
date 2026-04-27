import { eq } from 'drizzle-orm';
import { db } from '../../db/connection';
import { materialSuppliers } from '../../db/schema';
import type { MaterialSupplier } from '../../db/schema';
import type {
  CreateMaterialSupplierRequest,
  UpdateMaterialSupplierRequest,
} from '../../models/material-supplier.model';

export async function findAll(companyId: string): Promise<MaterialSupplier[]> {
  return db
    .select()
    .from(materialSuppliers)
    .where(eq(materialSuppliers.companyId, companyId))
    .orderBy(materialSuppliers.createdAt);
}

export async function findById(id: string): Promise<MaterialSupplier | null> {
  const result = await db
    .select()
    .from(materialSuppliers)
    .where(eq(materialSuppliers.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function create(
  companyId: string,
  data: CreateMaterialSupplierRequest
): Promise<MaterialSupplier> {
  const [supplier] = await db
    .insert(materialSuppliers)
    .values({
      companyId,
      name: data.name,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
    })
    .returning();
  return supplier!;
}

export async function update(
  id: string,
  data: UpdateMaterialSupplierRequest
): Promise<MaterialSupplier | null> {
  const [updated] = await db
    .update(materialSuppliers)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(materialSuppliers.id, id))
    .returning();
  return updated ?? null;
}

export async function remove(id: string): Promise<boolean> {
  const deleted = await db.delete(materialSuppliers).where(eq(materialSuppliers.id, id)).returning();
  return deleted.length > 0;
}
