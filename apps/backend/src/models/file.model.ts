import { z } from 'zod';

export const createFileSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.string().min(1).max(100),
  fileSize: z.number().int().positive(),
  filePath: z.string().min(1),
  mimeType: z.string().max(100).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateFileSchema = createFileSchema.partial();

export const fileQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  isArchived: z.coerce.boolean().optional(),
  sortBy: z.enum(['created_at', 'file_name', 'file_size']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateFileRequest = z.infer<typeof createFileSchema>;
export type UpdateFileRequest = z.infer<typeof updateFileSchema>;
export type FileQuery = z.infer<typeof fileQuerySchema>;
