import { eq, or } from 'drizzle-orm';
import { db } from '../../db/connection';
import { users, tenants } from '../../db/schema';
import type { User } from '../../db/schema';

export type UserWithTenant = Omit<User, 'password' | 'mfaSecret'> & { tenantName: string | null; companyId: string | null };

const userWithTenantColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  role: users.role,
  companyId: users.companyId,
  tenantId: users.tenantId,
  tenantName: tenants.name,
  isActive: users.isActive,
  mfaEnabled: users.mfaEnabled,
  lastUsedOtpAt: users.lastUsedOtpAt,
  lastLogin: users.lastLogin,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
} as const;

export async function findAll(): Promise<UserWithTenant[]> {
  return db
    .select(userWithTenantColumns)
    .from(users)
    .leftJoin(tenants, eq(users.tenantId, tenants.id))
    .orderBy(users.createdAt);
}

export async function findById(id: string): Promise<UserWithTenant | null> {
  const result = await db
    .select(userWithTenantColumns)
    .from(users)
    .leftJoin(tenants, eq(users.tenantId, tenants.id))
    .where(eq(users.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function findByIdFull(id: string): Promise<User | null> {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function findByEmail(email: string): Promise<User | null> {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result[0] ?? null;
}

export async function findAllByTenantId(tenantId: string): Promise<UserWithTenant[]> {
  return db
    .select(userWithTenantColumns)
    .from(users)
    .leftJoin(tenants, eq(users.tenantId, tenants.id))
    .where(eq(users.tenantId, tenantId))
    .orderBy(users.createdAt);
}

export async function findAllByCompanyId(companyId: string): Promise<UserWithTenant[]> {
  return db
    .select(userWithTenantColumns)
    .from(users)
    .leftJoin(tenants, eq(users.tenantId, tenants.id))
    .where(or(eq(tenants.companyId, companyId), eq(users.companyId, companyId)))
    .orderBy(users.createdAt);
}

export interface CreateUserData {
  email: string;
  password: string;
  name?: string | null;
  role: string;
  companyId?: string | null;
  tenantId?: string | null;
  isActive: boolean;
}

export async function create(data: CreateUserData): Promise<User> {
  const [user] = await db.insert(users).values(data).returning();
  return user!;
}

export interface UpdateUserData {
  email?: string;
  password?: string;
  name?: string;
  role?: string;
  companyId?: string | null;
  tenantId?: string | null;
  isActive?: boolean;
  mfaEnabled?: boolean;
  mfaSecret?: string;
  lastUsedOtpAt?: Date;
  lastLogin?: Date;
  updatedAt?: Date;
}

export async function update(id: string, data: UpdateUserData): Promise<User | null> {
  const [updated] = await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteById(id: string): Promise<boolean> {
  const deleted = await db.delete(users).where(eq(users.id, id)).returning();
  return deleted.length > 0;
}
