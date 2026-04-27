import { z } from 'zod';
import { Tenant } from '../db/schema';

// Response types
export type TenantResponse = Tenant;

export interface TenantWithCompanyResponse extends Tenant {
  companyName: string;
}

// Request validation schemas
export const createTenantSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  contactName: z.string().max(255).optional(),
  contactPhone: z.string().max(50).optional(),
  companyId: z.string().uuid('Invalid company ID').optional(),
});

export const updateTenantSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255).optional(),
  contactName: z.string().max(255).optional(),
  contactPhone: z.string().max(50).optional(),
  companyId: z.string().uuid('Invalid company ID').optional(),
});

// Request types inferred from schemas
export type CreateTenantRequest = z.infer<typeof createTenantSchema>;
export type UpdateTenantRequest = z.infer<typeof updateTenantSchema>;
