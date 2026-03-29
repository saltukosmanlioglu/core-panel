import { Request, Response, NextFunction } from 'express';
import * as repo from './tender-items.repo';
import { createTenderItemSchema, updateTenderItemSchema, reorderItemsSchema } from '../../models/tender-item.model';

function getCompanyId(req: Request, res: Response): string | null {
  if (!req.resolvedCompanyId) {
    res.status(400).json({ error: 'Şirket bağlamı yok', code: 'NO_COMPANY_CONTEXT' });
    return null;
  }
  return req.resolvedCompanyId;
}

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = getCompanyId(req, res); if (!companyId) return;
    const items = await repo.findByTenderId(companyId, String(req.params.tenderId));
    res.json({ items });
  } catch (err) { next(err); }
};

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = getCompanyId(req, res); if (!companyId) return;
    const item = await repo.findById(companyId, String(req.params.id));
    if (!item) { res.status(404).json({ error: 'Kalem bulunamadı', code: 'NOT_FOUND' }); return; }
    res.json({ item });
  } catch (err) { next(err); }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = getCompanyId(req, res); if (!companyId) return;
    const parsed = createTenderItemSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası', code: 'VALIDATION_ERROR' }); return; }
    const item = await repo.create(companyId, String(req.params.tenderId), parsed.data);
    res.status(201).json({ item });
  } catch (err) { next(err); }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = getCompanyId(req, res); if (!companyId) return;
    const parsed = updateTenderItemSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası', code: 'VALIDATION_ERROR' }); return; }
    const item = await repo.update(companyId, String(req.params.id), parsed.data);
    if (!item) { res.status(404).json({ error: 'Kalem bulunamadı', code: 'NOT_FOUND' }); return; }
    res.json({ item });
  } catch (err) { next(err); }
};

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = getCompanyId(req, res); if (!companyId) return;
    const deleted = await repo.remove(companyId, String(req.params.id));
    if (!deleted) { res.status(404).json({ error: 'Kalem bulunamadı', code: 'NOT_FOUND' }); return; }
    res.json({ status: 'ok' });
  } catch (err) { next(err); }
};

export const reorder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = getCompanyId(req, res); if (!companyId) return;
    const parsed = reorderItemsSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası', code: 'VALIDATION_ERROR' }); return; }
    await repo.reorder(companyId, parsed.data.items);
    res.json({ status: 'ok' });
  } catch (err) { next(err); }
};
