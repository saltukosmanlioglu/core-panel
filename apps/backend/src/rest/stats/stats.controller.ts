import { Request, Response, NextFunction } from 'express';
import * as statsRepo from './stats.repo';

export const getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.userCompanyId) {
      // COMPANY_ADMIN: scoped stats for their company
      const stats = await statsRepo.getCountsByCompany(req.userCompanyId);
      res.json({ stats });
    } else {
      // SUPER_ADMIN: platform-wide stats
      const stats = await statsRepo.getCounts();
      res.json({ stats });
    }
  } catch (err) {
    next(err);
  }
};
