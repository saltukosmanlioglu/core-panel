import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getTdb } from '../../lib/tenantDb';
import { tenderItemInputSchema } from '../../models/tender-item.model';
import * as repo from './tender-items.repo';

export const getByTenderId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tdb = getTdb(req);
    const tenderId = String(req.params.tenderId);
    const items = await repo.findByTenderId(tdb, tenderId);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const replaceAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tdb = getTdb(req);
    const tenderId = String(req.params.tenderId);
    const { items } = z.object({ items: z.array(tenderItemInputSchema) }).parse(req.body);
    await repo.replaceAll(tdb, tenderId, items);
    const updated = await repo.findByTenderId(tdb, tenderId);
    res.json({ items: updated });
  } catch (err) {
    next(err);
  }
};
