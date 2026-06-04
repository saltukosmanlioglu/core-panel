import { eq } from 'drizzle-orm';
import { db } from '../../db/connection';
import { users } from '../../db/schema';
import type { User } from '../../db/schema';

export type UserWithTenant = Omit<User, 'password' | 'mfaSecret'> & {
  name: string | null;
  tenantId: string | null;
  tenantName: string | null;
  companyId: string | null;
};

function normalizeNamePart(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function splitFullName(name: string | null | undefined): { firstName: string | null; lastName: string | null } {
  const normalized = normalizeNamePart(name);
  if (!normalized) return { firstName: null, lastName: null };

  const [firstName, ...lastNameParts] = normalized.split(/\s+/);
  return {
    firstName: firstName ?? null,
    lastName: lastNameParts.length > 0 ? lastNameParts.join(' ') : null,
  };
}

function resolveNameFields(data: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): { firstName?: string | null; lastName?: string | null } {
  const fromFullName: { firstName?: string | null; lastName?: string | null } =
    data.name !== undefined ? splitFullName(data.name) : {};

  return {
    firstName: data.firstName !== undefined ? normalizeNamePart(data.firstName) : fromFullName.firstName,
    lastName: data.lastName !== undefined ? normalizeNamePart(data.lastName) : fromFullName.lastName,
  };
}

function displayName(user: Pick<User, 'firstName' | 'lastName'>): string | null {
  const parts = [user.firstName, user.lastName].map(normalizeNamePart).filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(' ') : null;
}

function publicUser(user: User): UserWithTenant {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    name: displayName(user),
    role: user.role,
    companyId: user.companyId,
    tenantId: null,
    tenantName: null,
    isActive: user.isActive,
    mfaEnabled: user.mfaEnabled,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function findAll(): Promise<UserWithTenant[]> {
  const result = await db.select().from(users).orderBy(users.createdAt);
  return result.map(publicUser);
}

export async function findById(id: string): Promise<UserWithTenant | null> {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return result[0] ? publicUser(result[0]) : null;
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


export async function findAllByCompanyId(companyId: string): Promise<UserWithTenant[]> {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.companyId, companyId))
    .orderBy(users.createdAt);
  return result.map(publicUser);
}

export interface CreateUserData {
  email: string;
  password: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  companyId?: string | null;
  tenantId?: string | null;
  isActive: boolean;
}

export async function create(data: CreateUserData): Promise<User> {
  const nameFields = resolveNameFields(data);

  const [user] = await db
    .insert(users)
    .values({
      email: data.email,
      password: data.password,
      firstName: nameFields.firstName ?? null,
      lastName: nameFields.lastName ?? null,
      role: data.role,
      companyId: data.companyId ?? null,
      isActive: data.isActive,
    })
    .returning();
  return user!;
}

export interface UpdateUserData {
  email?: string;
  password?: string;
  name?: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: string;
  companyId?: string | null;
  tenantId?: string | null;
  isActive?: boolean;
  mfaEnabled?: boolean;
  mfaSecret?: string;
  lastLogin?: Date;
  updatedAt?: Date;
}

export async function update(id: string, data: UpdateUserData): Promise<User | null> {
  const updateData: Partial<typeof users.$inferInsert> = {};
  const nameFields = resolveNameFields(data);

  if (data.email !== undefined) updateData.email = data.email;
  if (data.password !== undefined) updateData.password = data.password;
  if (nameFields.firstName !== undefined) updateData.firstName = nameFields.firstName;
  if (nameFields.lastName !== undefined) updateData.lastName = nameFields.lastName;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.companyId !== undefined) updateData.companyId = data.companyId;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.mfaEnabled !== undefined) updateData.mfaEnabled = data.mfaEnabled;
  if (data.mfaSecret !== undefined) updateData.mfaSecret = data.mfaSecret;
  if (data.lastLogin !== undefined) updateData.lastLogin = data.lastLogin;
  updateData.updatedAt = new Date();

  const [updated] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteById(id: string): Promise<boolean> {
  const deleted = await db.delete(users).where(eq(users.id, id)).returning();
  return deleted.length > 0;
}
