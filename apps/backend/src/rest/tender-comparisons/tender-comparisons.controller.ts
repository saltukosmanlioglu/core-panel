import { Request, Response, NextFunction } from 'express';
import { getTdb } from '../../lib/tenantDb';
import * as tendersRepo from '../tenders/tenders.repo';
import * as tenantsRepo from '../tenants/tenants.repo';
import * as tenderComparisonsRepo from './tender-comparisons.repo';
import { runComparison } from './tender-comparisons.service';

export const getLatest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.resolvedCompanyId!;
    const tenderId = String(req.params.tenderId);
    const tender = await tendersRepo.findById(companyId, tenderId);

    if (!tender) {
      res.status(404).json({ error: 'İhale bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const comparison = await tenderComparisonsRepo.findLatestByTenderId(getTdb(req), tenderId);
    res.json({ comparison: comparison ?? null });
  } catch (error) {
    next(error);
  }
};

export const run = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.resolvedCompanyId!;
    const tenderId = String(req.params.tenderId);
    const tender = await tendersRepo.findById(companyId, tenderId);

    if (!tender) {
      res.status(404).json({ error: 'İhale bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const tenants = await tenantsRepo.findAllByCompanyId(companyId);
    const tenantMap: Record<string, string> = {};
    for (const tenant of tenants) {
      tenantMap[tenant.id] = tenant.name;
    }

    const result = await runComparison(getTdb(req), tenderId, req.userId!, tenantMap);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
