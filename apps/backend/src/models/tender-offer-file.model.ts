import { z } from 'zod';

export const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const uploadOfferFileSchema = z.object({
  tenantId: z.string().uuid('Invalid tenant ID'),
});

export type UploadOfferFileRequest = z.infer<typeof uploadOfferFileSchema>;
