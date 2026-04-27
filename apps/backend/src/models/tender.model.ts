import { z } from 'zod';

export const createTenderSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  categoryId: z.string().uuid('Invalid category ID').optional().nullable(),
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  status: z.enum(['draft', 'open', 'closed', 'awarded']).default('draft'),
  deadline: z.string().datetime({ offset: true }).optional(),
});

export const updateTenderSchema = z.object({
  projectId: z.string().uuid('Invalid project ID').optional(),
  categoryId: z.string().uuid('Invalid category ID').optional().nullable(),
  title: z.string().min(1, 'Title is required').max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['draft', 'open', 'closed', 'awarded']).optional(),
  deadline: z.string().datetime({ offset: true }).optional().nullable(),
});

export type CreateTenderRequest = z.infer<typeof createTenderSchema>;
export type UpdateTenderRequest = z.infer<typeof updateTenderSchema>;
