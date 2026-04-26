import { NextFunction, Request, Response } from 'express';
import { getTdb } from '../../lib/tenantDb';
import { bulkUpsertAwardItemsSchema, finalizeTenderSchema } from '../../models/tender-award.model';
import * as auditRepo from '../tender-audit-logs/tender-audit-logs.repo';
import * as tendersRepo from '../tenders/tenders.repo';
import * as awardsRepo from './tender-awards.repo';
import * as service from './tender-awards.service';

async function ensureTenderExists(req: Request, res: Response): Promise<boolean> {
  const companyId = req.resolvedCompanyId!;
  const tender = await tendersRepo.findById(companyId, String(req.params.tenderId));

  if (!tender) {
    res.status(404).json({ error: 'İhale bulunamadı', code: 'NOT_FOUND' });
    return false;
  }

  return true;
}

export const getAwardItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!(await ensureTenderExists(req, res))) {
      return;
    }

    const items = await awardsRepo.findByTenderId(getTdb(req), String(req.params.tenderId));
    res.json({ items });
  } catch (error) {
    next(error);
  }
};

export const getRecommendations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!(await ensureTenderExists(req, res))) {
      return;
    }

    const recommendations = await service.getRecommendations(getTdb(req), String(req.params.tenderId));
    res.json({ recommendations });
  } catch (error) {
    next(error);
  }
};

export const bulkUpsertItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!(await ensureTenderExists(req, res))) {
      return;
    }

    const parsed = bulkUpsertAwardItemsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Validation failed',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const tdb = getTdb(req);
    const result = await awardsRepo.bulkUpsert(tdb, String(req.params.tenderId), parsed.data.items, req.userId!);

    await auditRepo.create(
      tdb,
      String(req.params.tenderId),
      'items_awarded',
      {
        itemCount: parsed.data.items.length,
        awardedCount: parsed.data.items.filter((item) => item.status === 'awarded').length,
        pendingCount: parsed.data.items.filter((item) => item.status === 'pending_negotiation').length,
        excludedCount: parsed.data.items.filter((item) => item.status === 'excluded').length,
      },
      req.userId!,
    );

    res.json({ items: result });
  } catch (error) {
    next(error);
  }
};

export const finalizeTender = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!(await ensureTenderExists(req, res))) {
      return;
    }

    const parsed = finalizeTenderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Validation failed',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const result = await service.finalizeTender(getTdb(req), String(req.params.tenderId), req.userId!, parsed.data.note);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
