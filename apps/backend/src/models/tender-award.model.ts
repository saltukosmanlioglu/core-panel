import { z } from 'zod';

export type AwardItemStatus = 'awarded' | 'pending_negotiation' | 'excluded';

export const upsertAwardItemSchema = z.object({
  siraNo: z.number().int().positive(),
  description: z.string().optional(),
  awardedTenantId: z.string().uuid().nullable(),
  status: z.enum(['awarded', 'pending_negotiation', 'excluded']),
  note: z.string().optional(),
});

export const bulkUpsertAwardItemsSchema = z.object({
  items: z.array(upsertAwardItemSchema),
});

export const finalizeTenderSchema = z.object({
  note: z.string().optional(),
});

export type UpsertAwardItemRequest = z.infer<typeof upsertAwardItemSchema>;
export type BulkUpsertAwardItemsRequest = z.infer<typeof bulkUpsertAwardItemsSchema>;
