import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@core-panel/shared';

/**
 * Allows SUPER_ADMIN and COMPANY_ADMIN roles.
 * req.userRole and req.userCompanyId are set by verifyToken from the JWT.
 * Rejects COMPANY_ADMIN if their companyId is null (misconfigured account).
 */
export function requireAdminAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const role = req.userRole;

  if (role !== UserRole.SUPER_ADMIN && role !== UserRole.COMPANY_ADMIN) {
    res.status(403).json({ error: 'Insufficient permissions', code: 'FORBIDDEN' });
    return;
  }

  if (role === UserRole.COMPANY_ADMIN && !req.userCompanyId) {
    res.status(403).json({ error: 'Company admin has no associated company', code: 'NO_COMPANY' });
    return;
  }

  next();
}
