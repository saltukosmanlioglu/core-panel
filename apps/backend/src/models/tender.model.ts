import { z } from 'zod';

const boqItemSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().min(1, 'Description is required'),
  unit: z.string().min(1, 'Unit is required'),
  quantity: z.number().positive('Quantity must be positive'),
  location: z.string().max(255).optional(),
});

export const createTenderSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  status: z.enum(['draft', 'open', 'closed', 'awarded']).default('draft'),
  deadline: z.string().datetime({ offset: true }).optional(),
  items: z.array(boqItemSchema).optional().default([]),
});

export const updateTenderSchema = z.object({
  projectId: z.string().uuid('Invalid project ID').optional(),
  title: z.string().min(1, 'Title is required').max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['draft', 'open', 'closed', 'awarded']).optional(),
  deadline: z.string().datetime({ offset: true }).optional().nullable(),
  items: z.array(boqItemSchema).optional().default([]),
});

export type CreateTenderRequest = z.infer<typeof createTenderSchema>;
export type UpdateTenderRequest = z.infer<typeof updateTenderSchema>;
