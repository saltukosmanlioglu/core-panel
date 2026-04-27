import { Request, Response, NextFunction } from 'express';
import * as tendersRepo from './tenders.repo';
import * as categoriesRepo from '../categories/categories.repo';
import { createTenderSchema, updateTenderSchema } from '../../models/tender.model';

async function categoryBelongsToCompany(categoryId: string, companyId: string): Promise<boolean> {
  const category = await categoriesRepo.findById(categoryId);
  return !!category && category.companyId === companyId;
}

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rawLimit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    const limit = rawLimit && Number.isInteger(rawLimit) && rawLimit > 0 ? rawLimit : undefined;
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    const sortOrder = req.query.sortOrder === 'desc' ? 'desc' : 'asc';
    const options = { limit, projectId, sortOrder } as const;
    const tenders = req.resolvedCompanyId
      ? await tendersRepo.findAll(req.resolvedCompanyId, options)
      : await tendersRepo.findAllAcrossCompanies(options);
    res.json({ tenders });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tender = req.resolvedCompanyId
      ? await tendersRepo.findById(req.resolvedCompanyId, String(req.params.id))
      : await tendersRepo.findByIdAcrossCompanies(String(req.params.id));
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
    if (
      parsed.data.categoryId &&
      !(await categoryBelongsToCompany(parsed.data.categoryId, req.resolvedCompanyId!))
    ) {
      res.status(400).json({ error: 'Geçersiz kategori', code: 'VALIDATION_ERROR' });
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
    if (
      parsed.data.categoryId &&
      !(await categoryBelongsToCompany(parsed.data.categoryId, req.resolvedCompanyId!))
    ) {
      res.status(400).json({ error: 'Geçersiz kategori', code: 'VALIDATION_ERROR' });
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
