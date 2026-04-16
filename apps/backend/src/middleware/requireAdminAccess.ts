import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@core-panel/shared';

/**
 * Allows COMPANY_ADMIN role only.
 * req.userRole and req.userCompanyId are set by verifyToken from the JWT.
 * Rejects if companyId is null (misconfigured account).
 */
export function requireAdminAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.userRole !== UserRole.COMPANY_ADMIN) {
    res.status(403).json({ error: 'Insufficient permissions', code: 'FORBIDDEN' });
    return;
  }

  if (!req.userCompanyId) {
    res.status(403).json({ error: 'Company admin has no associated company', code: 'NO_COMPANY' });
    return;
  }

  next();
}
