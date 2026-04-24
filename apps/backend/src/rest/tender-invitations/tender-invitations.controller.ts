import { Request, Response, NextFunction } from 'express';
import { TenantDb } from '../../lib/tenantDb';
import { updateInvitationsSchema } from '../../models/tender-invitation.model';
import * as tendersRepo from '../tenders/tenders.repo';
import * as tenantsRepo from '../tenants/tenants.repo';
import * as tenderInvitationsRepo from './tender-invitations.repo';

export const getByTenderId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.resolvedCompanyId!;
    const tenderId = String(req.params.tenderId);
    const tender = await tendersRepo.findById(companyId, tenderId);

    if (!tender) {
      res.status(404).json({ error: 'İhale bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const tenantIds = await tenderInvitationsRepo.findByTenderId(new TenantDb(companyId), tenderId);
    res.json({ tenantIds });
  } catch (error) {
    next(error);
  }
};

export const replaceAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = updateInvitationsSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Validation failed',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const companyId = req.resolvedCompanyId!;
    const tenderId = String(req.params.tenderId);
    const tender = await tendersRepo.findById(companyId, tenderId);

    if (!tender) {
      res.status(404).json({ error: 'İhale bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const companyTenants = await tenantsRepo.findAllByCompanyId(companyId);
    const allowedTenantIds = new Set(companyTenants.map((tenant) => tenant.id));
    const invalidTenantId = parsed.data.tenantIds.find((tenantId) => !allowedTenantIds.has(tenantId));

    if (invalidTenantId) {
      res.status(400).json({
        error: 'One or more tenants do not belong to this company',
        code: 'INVALID_TENANT',
      });
      return;
    }

    const uniqueTenantIds = Array.from(new Set(parsed.data.tenantIds));
    const tenantIds = await tenderInvitationsRepo.replaceAll(new TenantDb(companyId), tenderId, uniqueTenantIds);

    res.json({ tenantIds });
  } catch (error) {
    next(error);
  }
};
