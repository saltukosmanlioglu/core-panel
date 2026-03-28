import { z } from 'zod';

export const createTenderSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  status: z.enum(['draft', 'open', 'closed', 'awarded']).default('draft'),
  budget: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid budget amount').optional(),
  deadline: z.string().datetime({ offset: true }).optional(),
});

export const updateTenderSchema = z.object({
  projectId: z.string().uuid('Invalid project ID').optional(),
  title: z.string().min(1, 'Title is required').max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['draft', 'open', 'closed', 'awarded']).optional(),
  budget: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid budget amount').optional(),
  deadline: z.string().datetime({ offset: true }).optional().nullable(),
});

export type CreateTenderRequest = z.infer<typeof createTenderSchema>;
export type UpdateTenderRequest = z.infer<typeof updateTenderSchema>;
