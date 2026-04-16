import { Request, Response, NextFunction } from 'express';
import * as tenantsRepo from '../rest/tenants/tenants.repo';

/**
 * Resolves which company schema to query and attaches it as req.resolvedCompanyId.
 *
 * - COMPANY_ADMIN: uses req.userCompanyId from JWT
 * - TENANT_ADMIN / USER: derives companyId via their tenantId → tenants.companyId
 */
export async function resolveCompany(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (req.userCompanyId) {
      req.resolvedCompanyId = req.userCompanyId;
      next();
      return;
    }

    if (req.userTenantId) {
      const tenant = await tenantsRepo.findById(req.userTenantId);
      if (!tenant) {
        res.status(403).json({ error: 'Tenant not found', code: 'TENANT_NOT_FOUND' });
        return;
      }
      req.resolvedCompanyId = tenant.companyId;
      next();
      return;
    }

    res.status(403).json({ error: 'No company context for this user', code: 'NO_COMPANY_CONTEXT' });
  } catch (err) {
    next(err);
  }
}
