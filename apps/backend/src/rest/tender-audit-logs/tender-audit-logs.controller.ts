import { NextFunction, Request, Response } from 'express';
import { getTdb } from '../../lib/tenantDb';
import * as tendersRepo from '../tenders/tenders.repo';
import * as auditRepo from './tender-audit-logs.repo';

export const getByTenderId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.resolvedCompanyId!;
    const tender = await tendersRepo.findById(companyId, String(req.params.tenderId));

    if (!tender) {
      res.status(404).json({ error: 'İhale bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const logs = await auditRepo.findByTenderId(getTdb(req), String(req.params.tenderId));
    res.json({ logs });
  } catch (error) {
    next(error);
  }
};
