import { z } from 'zod';

export const tenderItemInputSchema = z.object({
  id: z.string().uuid().optional(),
  posNo: z.string().max(50).optional(),
  description: z.string().min(1, 'Description is required'),
  unit: z.string().min(1, 'Unit is required').max(50),
  quantity: z.number().positive('Quantity must be positive'),
  location: z.string().max(255).optional(),
});

export type TenderItemInput = z.infer<typeof tenderItemInputSchema>;
