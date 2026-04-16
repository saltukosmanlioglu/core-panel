import { z } from 'zod';
import { User } from '../db/schema';
import { UserRole } from '@core-panel/shared';

// Response types
export type UserResponse = Omit<User, 'password'>;

export interface UserWithTenantResponse extends Omit<User, 'password'> {
  tenantName: string | null;
}

// Request validation schemas
export const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password must be at most 72 characters'),
  role: z.enum([
    UserRole.COMPANY_ADMIN,
    UserRole.TENANT_ADMIN,
  ]),
  companyId: z.string().uuid('Invalid company ID').nullable().optional(),
  tenantId: z.string().uuid('Invalid tenant ID').nullable().optional(),
  isActive: z.boolean().default(true),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).max(72).optional(),
  role: z.enum([
    UserRole.COMPANY_ADMIN,
    UserRole.TENANT_ADMIN,
  ]).optional(),
  companyId: z.string().uuid().nullable().optional(),
  tenantId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

// Request types inferred from schemas
export type CreateUserRequest = z.infer<typeof createUserSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserSchema>;
