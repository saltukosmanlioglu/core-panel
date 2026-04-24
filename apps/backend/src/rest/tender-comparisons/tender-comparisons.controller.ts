import { Request, Response, NextFunction } from 'express';
import { TenantDb } from '../../lib/tenantDb';
import * as tendersRepo from '../tenders/tenders.repo';
import * as tenderOfferFilesRepo from '../tender-offer-files/tender-offer-files.repo';
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

    const comparison = await tenderComparisonsRepo.findLatestByTenderId(new TenantDb(companyId), tenderId);
    res.json({ comparison });
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

    const offerFiles = await tenderOfferFilesRepo.findByTenderId(new TenantDb(companyId), tenderId);
    if (offerFiles.length < 2) {
      res.status(400).json({
        error: 'At least 2 offer files are required for comparison',
        code: 'INSUFFICIENT_FILES',
      });
      return;
    }

    const comparison = await tenderComparisonsRepo.create(new TenantDb(companyId), tenderId, req.userId!);
    void runComparison(companyId, tenderId, comparison.id);

    res.status(202).json({ comparison });
  } catch (error) {
    next(error);
  }
};
