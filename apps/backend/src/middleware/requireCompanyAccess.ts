import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection';
import { users, tenants } from '../db/schema';
import { UserRole } from '@core-panel/shared';

/**
 * Verifies the requesting user has access to the company identified by
 * `req.params.companyId`.
 *
 * - SUPER_ADMIN: always allowed.
 * - All other roles: the user must belong to a tenant that is under the
 *   requested company (users.tenantId → tenants.companyId === companyId).
 *
 * Must be used after `verifyToken` + `checkIsActive`.
 */
export async function requireCompanyAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Super admins can access any company
    if (req.userRole === UserRole.SUPER_ADMIN) {
      next();
      return;
    }

    const companyId = req.params.companyId;

    // Look up the user's tenant and its associated company
    const result = await db
      .select({ tenantCompanyId: tenants.companyId })
      .from(users)
      .innerJoin(tenants, eq(users.tenantId, tenants.id))
      .where(eq(users.id, req.userId!))
      .limit(1);

    if (!result[0] || result[0].tenantCompanyId !== companyId) {
      res.status(403).json({ error: 'Access denied to this company', code: 'FORBIDDEN' });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}
