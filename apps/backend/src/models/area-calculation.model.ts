import { z } from 'zod';

export const AREA_CALCULATION_FILE_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const analyzeAreaCalculationSchema = z.object({
  note: z.string().trim().max(2000).optional(),
});

export type AnalyzeAreaCalculationInput = z.infer<typeof analyzeAreaCalculationSchema>;
