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
  note: z.string().optional(),
  notes: z.string().optional(),
});

export const updatePropertyOwnerSchema = createPropertyOwnerSchema.partial();

const bulkPropertyOwnerSchema = z.object({
  name: z.string().min(1).max(255),
  floor_number: nullableNumber,
  apartment_number: z.string().max(20).optional(),
  apartment_size_sqm: nullableNumber,
  notes: z.string().optional(),
});

export const bulkUpsertPropertyOwnersSchema = z.object({
  owners: z.array(bulkPropertyOwnerSchema),
});

export type CreatePropertyOwnerInput = z.infer<typeof createPropertyOwnerSchema>;
export type UpdatePropertyOwnerInput = z.infer<typeof updatePropertyOwnerSchema>;
export type BulkPropertyOwnerInput = z.infer<typeof bulkPropertyOwnerSchema>;
