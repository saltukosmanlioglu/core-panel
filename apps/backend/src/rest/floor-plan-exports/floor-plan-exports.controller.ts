import { NextFunction, Request, Response } from 'express';
import { getTdb } from '../../lib/tenantDb';
import { validateUUID } from '../../middleware/validateUUID';
import * as repo from './floor-plan-exports.repo';

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const exports = await repo.findByProjectId(getTdb(req), String(req.params.projectId));
    res.json({ exports });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const floorPlanExport = await repo.findById(getTdb(req), String(req.params.id));

    if (!floorPlanExport) {
      res.status(404).json({ error: 'Kat planı dışa aktarımı bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    res.json({ export: floorPlanExport });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const floorPlanExport = await repo.remove(getTdb(req), String(req.params.id));

    if (!floorPlanExport) {
      res.status(404).json({ error: 'Kat planı dışa aktarımı bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
};
