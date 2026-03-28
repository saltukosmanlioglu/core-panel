import bcrypt from 'bcrypt';
import * as usersRepo from './users.repo';
import type { CreateUserRequest, UpdateUserRequest } from '../../models/user.model';
import type { User } from '../../db/schema';
import { AppError } from '../../lib/AppError';

export async function createUser(data: CreateUserRequest): Promise<User> {
  const hashedPassword = await bcrypt.hash(data.password, 12);
  return usersRepo.create({ ...data, password: hashedPassword });
}

export async function updateUser(id: string, data: UpdateUserRequest, requestingUserId: string): Promise<User> {
  if (id === requestingUserId && data.isActive === false) {
    throw new AppError('You cannot deactivate your own account', 403, 'SELF_DEACTIVATE_NOT_ALLOWED');
  }

  const existing = await usersRepo.findById(id);
  if (!existing) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  const updateData: usersRepo.UpdateUserData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.companyId !== undefined) updateData.companyId = data.companyId;
  if (data.tenantId !== undefined) updateData.tenantId = data.tenantId;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.password && data.password.length >= 8) {
    updateData.password = await bcrypt.hash(data.password, 12);
  }

  const updated = await usersRepo.update(id, updateData);
  if (!updated) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }
  return updated;
}

export async function deleteUser(id: string, requestingUserId: string): Promise<void> {
  if (id === requestingUserId) {
    throw new AppError('You cannot delete your own account', 403, 'SELF_DELETE_NOT_ALLOWED');
  }

  const existing = await usersRepo.findById(id);
  if (!existing) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }
  await usersRepo.deleteById(id);
}
