import { Request, Response, NextFunction } from 'express';
import * as tendersRepo from './tenders.repo';
import { createTenderSchema, updateTenderSchema } from '../../models/tender.model';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenders = req.resolvedCompanyId
      ? await tendersRepo.findAll(req.resolvedCompanyId)
      : await tendersRepo.findAllAcrossCompanies();
    res.json({ tenders });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tender = await tendersRepo.findById(req.resolvedCompanyId!, String(req.params.id));
    if (!tender) {
      res.status(404).json({ error: 'İhale bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    res.json({ tender });
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = createTenderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası', code: 'VALIDATION_ERROR' });
      return;
    }
    const { deadline, ...rest } = parsed.data;
    const tender = await tendersRepo.create(req.resolvedCompanyId!, {
      ...rest,
      deadline: deadline ? new Date(deadline) : undefined,
    });
    res.status(201).json({ tender });
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = updateTenderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası', code: 'VALIDATION_ERROR' });
      return;
    }
    const { deadline, ...rest } = parsed.data;
    const tender = await tendersRepo.update(req.resolvedCompanyId!, String(req.params.id), {
      ...rest,
      ...(deadline !== undefined ? { deadline: deadline ? new Date(deadline) : null } : {}),
    });
    if (!tender) {
      res.status(404).json({ error: 'İhale bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    res.json({ tender });
  } catch (err) {
    next(err);
  }
};

export const deleteById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const deleted = await tendersRepo.deleteById(req.resolvedCompanyId!, String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'İhale bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
};
