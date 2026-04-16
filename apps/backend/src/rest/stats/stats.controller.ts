import { Request, Response, NextFunction } from 'express';
import * as statsRepo from './stats.repo';

export const getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stats = await statsRepo.getCountsByCompany(req.userCompanyId!);
    res.json({ stats });
  } catch (err) {
    next(err);
  }
};
