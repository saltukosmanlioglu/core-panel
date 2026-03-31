import { z } from 'zod';

export const createTenderItemSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  rowNo: z.number().int().min(1).optional().default(1),
  posNo: z.string().max(50).optional(),
  description: z.string().min(1, 'Tanım zorunludur'),
  unit: z.string().min(1, 'Birim zorunludur').max(50),
  quantity: z.number().min(0, 'Miktar 0 veya daha büyük olmalıdır'),
  location: z.string().max(255).optional(),
  orderNo: z.number().int().min(0).optional().default(0),
});

export const updateTenderItemSchema = createTenderItemSchema.partial();

export const reorderItemsSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    orderNo: z.number().int().min(0),
  })).min(1),
});

export type CreateTenderItemRequest = z.infer<typeof createTenderItemSchema>;
export type UpdateTenderItemRequest = z.infer<typeof updateTenderItemSchema>;
export type ReorderItemsRequest = z.infer<typeof reorderItemsSchema>;
