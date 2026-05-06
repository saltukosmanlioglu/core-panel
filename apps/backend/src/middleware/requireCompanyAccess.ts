import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection';
import { users } from '../db/schema';

/**
 * Verifies the requesting user has access to the company identified by
 * `req.params.companyId`.
 *
 * The user must belong to the requested company.
 *
 * Must be used after `verifyToken` + `checkIsActive`.
 */
export async function requireCompanyAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const companyId = req.params.companyId;

    // Look up the user's tenant and its associated company
    const result = await db
      .select({ userCompanyId: users.companyId })
      .from(users)
      .where(eq(users.id, req.userId!))
      .limit(1);

    if (!result[0] || result[0].userCompanyId !== companyId) {
      res.status(403).json({ error: 'Access denied to this company', code: 'FORBIDDEN' });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}
