import { z } from 'zod';

export const generateThreeDModelImageSchema = z.object({
  prompt: z.string().trim().min(3, 'Bina tanımı en az 3 karakter olmalıdır').max(600),
});

export const generateThreeDModelFromImageSchema = z.object({
  selectedImageUrl: z.string().trim().min(1, 'Görsel seçimi zorunludur').max(2000),
});

export const updateThreeDModelStatusSchema = z.object({
  status: z.enum(['PENDING', 'IMAGE_GENERATING', 'IMAGE_DONE', 'MODEL_GENERATING', 'COMPLETED', 'FAILED']),
  reason: z.string().trim().max(255).optional(),
});
