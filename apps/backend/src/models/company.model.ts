import { z } from 'zod';
import { Company } from '../db/schema';

// Response types
export type CompanyResponse = Company;

// Request validation schemas
export const createCompanySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
});

export const updateCompanySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
});

// Request types inferred from schemas
export type CreateCompanyRequest = z.infer<typeof createCompanySchema>;
export type UpdateCompanyRequest = z.infer<typeof updateCompanySchema>;
