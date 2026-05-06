import { z } from 'zod';

const nullableNumber = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.coerce.number().optional(),
);

export const createPropertyOwnerSchema = z.object({
  name: z.string().min(1).max(255),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional().or(z.literal('')),
  floorNumber: nullableNumber,
  apartmentNumber: z.string().max(20).optional(),
  apartmentSizeSqm: nullableNumber,
  sharePercentage: nullableNumber,
  notes: z.string().optional(),
});

export const updatePropertyOwnerSchema = createPropertyOwnerSchema.partial();

export type CreatePropertyOwnerInput = z.infer<typeof createPropertyOwnerSchema>;
export type UpdatePropertyOwnerInput = z.infer<typeof updatePropertyOwnerSchema>;
