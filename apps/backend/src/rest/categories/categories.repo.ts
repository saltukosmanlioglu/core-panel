import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/connection';
import { categories, tenantCategories, materialSupplierCategories } from '../../db/schema';
import type { Category } from '../../db/schema';
import type { CreateCategoryRequest, UpdateCategoryRequest } from '../../models/category.model';

export const findAll = async (companyId: string): Promise<Category[]> => {
  return db
    .select()
    .from(categories)
    .where(eq(categories.companyId, companyId))
    .orderBy(categories.name);
};

export const findById = async (id: string): Promise<Category | null> => {
  const result = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return result[0] ?? null;
};

export const create = async (
  companyId: string,
  data: CreateCategoryRequest
): Promise<Category> => {
  const [category] = await db
    .insert(categories)
    .values({ companyId, name: data.name, updatedAt: new Date() })
    .returning();
  return category!;
};

export const update = async (
  id: string,
  data: UpdateCategoryRequest
): Promise<Category | null> => {
  const [category] = await db
    .update(categories)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(categories.id, id))
    .returning();
  return category ?? null;
};

export const remove = async (id: string): Promise<boolean> => {
  const deleted = await db.delete(categories).where(eq(categories.id, id)).returning();
  return deleted.length > 0;
};

export const findCategoriesByTenantId = async (tenantId: string): Promise<string[]> => {
  const result = await db
    .select({ categoryId: tenantCategories.categoryId })
    .from(tenantCategories)
    .where(eq(tenantCategories.tenantId, tenantId));
  return result.map((row) => row.categoryId);
};

export const findTenantsByCategory = async (categoryId: string): Promise<string[]> => {
  const result = await db
    .select({ tenantId: tenantCategories.tenantId })
    .from(tenantCategories)
    .where(eq(tenantCategories.categoryId, categoryId));
  return result.map((row) => row.tenantId);
};

export const replaceTenantCategories = async (
  tenantId: string,
  categoryIds: string[]
): Promise<void> => {
  await db.delete(tenantCategories).where(eq(tenantCategories.tenantId, tenantId));
  if (categoryIds.length > 0) {
    await db.insert(tenantCategories).values(categoryIds.map((categoryId) => ({ tenantId, categoryId })));
  }
};

export const findCategoriesBySupplierId = async (supplierId: string): Promise<string[]> => {
  const result = await db
    .select({ categoryId: materialSupplierCategories.categoryId })
    .from(materialSupplierCategories)
    .where(eq(materialSupplierCategories.supplierId, supplierId));
  return result.map((row) => row.categoryId);
};

export const findCategoriesByTenantIds = async (tenantIds: string[]): Promise<Record<string, string[]>> => {
  if (tenantIds.length === 0) return {};
  const result = await db
    .select({ tenantId: tenantCategories.tenantId, categoryId: tenantCategories.categoryId })
    .from(tenantCategories)
    .where(inArray(tenantCategories.tenantId, tenantIds));
  const map: Record<string, string[]> = {};
  for (const row of result) {
    if (!map[row.tenantId]) map[row.tenantId] = [];
    map[row.tenantId]!.push(row.categoryId);
  }
  return map;
};

export const findCategoriesBySupplierIds = async (supplierIds: string[]): Promise<Record<string, string[]>> => {
  if (supplierIds.length === 0) return {};
  const result = await db
    .select({ supplierId: materialSupplierCategories.supplierId, categoryId: materialSupplierCategories.categoryId })
    .from(materialSupplierCategories)
    .where(inArray(materialSupplierCategories.supplierId, supplierIds));
  const map: Record<string, string[]> = {};
  for (const row of result) {
    if (!map[row.supplierId]) map[row.supplierId] = [];
    map[row.supplierId]!.push(row.categoryId);
  }
  return map;
};

export const replaceSupplierCategories = async (
  supplierId: string,
  categoryIds: string[]
): Promise<void> => {
  await db
    .delete(materialSupplierCategories)
    .where(eq(materialSupplierCategories.supplierId, supplierId));
  if (categoryIds.length > 0) {
    await db
      .insert(materialSupplierCategories)
      .values(categoryIds.map((categoryId) => ({ supplierId, categoryId })));
  }
};
