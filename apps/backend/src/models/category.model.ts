import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Kategori adı zorunludur').max(255),
});

export const updateCategorySchema = createCategorySchema.partial();

export const updateEntityCategoriesSchema = z.object({
  categoryIds: z.array(z.string().uuid()),
});

export type CreateCategoryRequest = z.infer<typeof createCategorySchema>;
export type UpdateCategoryRequest = z.infer<typeof updateCategorySchema>;
export type UpdateEntityCategoriesRequest = z.infer<typeof updateEntityCategoriesSchema>;
