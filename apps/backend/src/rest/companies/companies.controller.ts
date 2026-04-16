import { Request, Response, NextFunction } from 'express';
import * as companiesRepo from './companies.repo';
import * as companiesService from './companies.service';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const company = await companiesRepo.findById(req.userCompanyId!);
    res.json({ companies: company ? [company] : [] });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.userCompanyId && req.userCompanyId !== req.params.id) {
      res.status(403).json({ error: 'Erişim reddedildi', code: 'FORBIDDEN' });
      return;
    }
    const company = await companiesRepo.findById(String(req.params.id));
    if (!company) {
      res.status(404).json({ error: 'Şirket bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    res.json({ company });
  } catch (err) {
    next(err);
  }
};

export const reprovision = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.userCompanyId && req.userCompanyId !== req.params.id) {
      res.status(403).json({ error: 'Erişim reddedildi', code: 'FORBIDDEN' });
      return;
    }
    const company = await companiesService.reprovisionSchema(String(req.params.id));
    res.json({ company });
  } catch (err) {
    next(err);
  }
};
