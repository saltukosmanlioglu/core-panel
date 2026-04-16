import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@core-panel/shared';

/**
 * Allows COMPANY_ADMIN and TENANT_ADMIN roles.
 * COMPANY_ADMIN must have a companyId; TENANT_ADMIN must have a tenantId.
 */
export function requireTenantAdminAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const role = req.userRole;

  if (role !== UserRole.COMPANY_ADMIN && role !== UserRole.TENANT_ADMIN) {
    res.status(403).json({ error: 'Insufficient permissions', code: 'FORBIDDEN' });
    return;
  }

  if (role === UserRole.COMPANY_ADMIN && !req.userCompanyId) {
    res.status(403).json({ error: 'Company admin has no associated company', code: 'NO_COMPANY' });
    return;
  }

  if (role === UserRole.TENANT_ADMIN && !req.userTenantId) {
    res.status(403).json({ error: 'Tenant admin has no associated tenant', code: 'NO_TENANT' });
    return;
  }

  next();
}
