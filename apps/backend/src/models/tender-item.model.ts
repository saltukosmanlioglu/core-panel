import { z } from 'zod';

export const createTenderItemSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  rowNo: z.number().int().positive(),
  posNo: z.string().max(50).optional(),
  description: z.string().min(1, 'Description is required'),
  unit: z.string().min(1, 'Unit is required').max(50),
  quantity: z.number().positive('Quantity must be positive'),
  location: z.string().max(255).optional(),
  orderNo: z.number().int().default(0),
});

export const updateTenderItemSchema = createTenderItemSchema.partial();

export const reorderItemsSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    orderNo: z.number().int(),
  })),
});

export type CreateTenderItemRequest = z.infer<typeof createTenderItemSchema>;
export type UpdateTenderItemRequest = z.infer<typeof updateTenderItemSchema>;
export type ReorderItemsRequest = z.infer<typeof reorderItemsSchema>;
