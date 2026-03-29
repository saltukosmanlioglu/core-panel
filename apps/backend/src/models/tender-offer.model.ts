import { z } from 'zod';

export const bulkUpdateOfferItemsSchema = z.object({
  items: z.array(z.object({
    itemId: z.string().uuid(),
    materialUnitPrice: z.number().min(0),
    laborUnitPrice: z.number().min(0),
  })),
});

export const reviewOfferSchema = z.object({
  notes: z.string().optional(),
});

export type BulkUpdateOfferItemsRequest = z.infer<typeof bulkUpdateOfferItemsSchema>;
export type ReviewOfferRequest = z.infer<typeof reviewOfferSchema>;
