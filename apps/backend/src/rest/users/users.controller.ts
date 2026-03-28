import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../../db/connection';
import { tenants } from '../../db/schema';
import * as usersRepo from './users.repo';
import * as usersService from './users.service';
import { createUserSchema, updateUserSchema } from '../../models/user.model';
import { UserRole } from '@core-panel/shared';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let all;
    if (req.userTenantId) {
      all = await usersRepo.findAllByTenantId(req.userTenantId);
    } else if (req.userCompanyId) {
      all = await usersRepo.findAllByCompanyId(req.userCompanyId);
    } else {
      all = await usersRepo.findAll();
    }
    res.json({ users: all });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await usersRepo.findById(String(req.params.id));
    if (!user) {
      res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
      return;
    }
    if (req.userTenantId) {
      if (user.tenantId !== req.userTenantId) {
        res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
        return;
      }
    } else if (req.userCompanyId) {
      const belongsToCompany =
        user.companyId === req.userCompanyId ||
        (await isTenantInCompany(user.tenantId, req.userCompanyId));
      if (!belongsToCompany) {
        res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
        return;
      }
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Validation failed',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    if (req.userTenantId) {
      // TENANT_ADMIN: can only create USER-role accounts within their own tenant
      if (parsed.data.role !== UserRole.USER) {
        res.status(403).json({
          error: 'Tenant admin can only create users with the User role',
          code: 'FORBIDDEN',
        });
        return;
      }
    } else if (req.userCompanyId) {
      // COMPANY_ADMIN restrictions
      if (
        parsed.data.role === UserRole.SUPER_ADMIN ||
        parsed.data.role === UserRole.COMPANY_ADMIN
      ) {
        res.status(403).json({
          error: 'Cannot create users with this role',
          code: 'FORBIDDEN',
        });
        return;
      }
      if (parsed.data.tenantId) {
        const valid = await isTenantInCompany(parsed.data.tenantId, req.userCompanyId);
        if (!valid) {
          res.status(403).json({ error: 'Tenant does not belong to your company', code: 'FORBIDDEN' });
          return;
        }
      }
    }

    // Auto-set tenantId/companyId based on the caller's scope
    let createData = { ...parsed.data };
    if (req.userTenantId) {
      createData.tenantId = req.userTenantId;
      createData.companyId = createData.companyId ?? req.userCompanyId ?? null;
    } else if (req.userCompanyId) {
      createData.companyId = createData.companyId ?? req.userCompanyId;
    }
    const user = await usersService.createUser(createData);
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Validation failed',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    if (req.userTenantId) {
      const existing = await usersRepo.findById(String(req.params.id));
      if (!existing) {
        res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
        return;
      }
      if (existing.tenantId !== req.userTenantId) {
        res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
        return;
      }
      // TENANT_ADMIN cannot change role
      if (parsed.data.role !== undefined && parsed.data.role !== UserRole.USER) {
        res.status(403).json({ error: 'Tenant admin can only assign the User role', code: 'FORBIDDEN' });
        return;
      }
    } else if (req.userCompanyId) {
      const existing = await usersRepo.findById(String(req.params.id));
      if (!existing) {
        res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
        return;
      }
      const belongsToCompany =
        existing.companyId === req.userCompanyId ||
        (await isTenantInCompany(existing.tenantId, req.userCompanyId));
      if (!belongsToCompany) {
        res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
        return;
      }
      // COMPANY_ADMIN cannot escalate roles
      if (
        parsed.data.role === UserRole.SUPER_ADMIN ||
        parsed.data.role === UserRole.COMPANY_ADMIN
      ) {
        res.status(403).json({ error: 'Cannot assign this role', code: 'FORBIDDEN' });
        return;
      }
    }

    const user = await usersService.updateUser(String(req.params.id), parsed.data, req.userId!);
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

export const deleteById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.userTenantId) {
      const existing = await usersRepo.findById(String(req.params.id));
      if (!existing) {
        res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
        return;
      }
      if (existing.tenantId !== req.userTenantId) {
        res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
        return;
      }
    } else if (req.userCompanyId) {
      const existing = await usersRepo.findById(String(req.params.id));
      if (!existing) {
        res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
        return;
      }
      const belongsToCompany =
        existing.companyId === req.userCompanyId ||
        (await isTenantInCompany(existing.tenantId, req.userCompanyId));
      if (!belongsToCompany) {
        res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
        return;
      }
    }
    await usersService.deleteUser(String(req.params.id), req.userId!);
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
};

async function isTenantInCompany(tenantId: string | null | undefined, companyId: string): Promise<boolean> {
  if (!tenantId) return false;
  const result = await db
    .select({ companyId: tenants.companyId })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return result[0]?.companyId === companyId;
}
