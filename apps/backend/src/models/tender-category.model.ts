import { z } from 'zod';

export const createTenderCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  orderNo: z.number().int().default(0),
});

export const updateTenderCategorySchema = createTenderCategorySchema.partial();

export type CreateTenderCategoryRequest = z.infer<typeof createTenderCategorySchema>;
export type UpdateTenderCategoryRequest = z.infer<typeof updateTenderCategorySchema>;
