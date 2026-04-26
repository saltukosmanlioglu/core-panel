import { z } from 'zod';

export const upsertTenderItemNoteSchema = z.object({
  note: z.string().trim().min(1, 'Not zorunludur').max(5000, 'Not çok uzun'),
});

export type UpsertTenderItemNoteRequest = z.infer<typeof upsertTenderItemNoteSchema>;
