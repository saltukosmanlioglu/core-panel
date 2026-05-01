import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive', 'completed']).default('active'),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive', 'completed']).optional(),
});

export const updateProjectStatusSchema = z.object({
  status: z.enum(['active', 'approved', 'lost']),
  note: z.string().optional(),
});

export type CreateProjectRequest = z.infer<typeof createProjectSchema>;
export type UpdateProjectRequest = z.infer<typeof updateProjectSchema>;
export type UpdateProjectStatusRequest = z.infer<typeof updateProjectStatusSchema>;
