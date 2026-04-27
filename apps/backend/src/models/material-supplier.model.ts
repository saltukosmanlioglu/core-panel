import { z } from 'zod';

export const createMaterialSupplierSchema = z.object({
  name: z.string().min(1, 'Firma adı zorunludur').max(255),
  contactName: z.string().max(255).optional(),
  contactPhone: z.string().max(50).optional(),
});

export const updateMaterialSupplierSchema = createMaterialSupplierSchema.partial();

export type CreateMaterialSupplierRequest = z.infer<typeof createMaterialSupplierSchema>;
export type UpdateMaterialSupplierRequest = z.infer<typeof updateMaterialSupplierSchema>;
