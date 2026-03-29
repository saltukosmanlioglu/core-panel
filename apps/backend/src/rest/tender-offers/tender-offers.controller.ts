import { Request, Response, NextFunction } from 'express';
import * as repo from './tender-offers.repo';
import { bulkUpdateOfferItemsSchema, reviewOfferSchema } from '../../models/tender-offer.model';
import { UserRole } from '@core-panel/shared';

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
    const offers = await repo.findByTenderId(companyId, String(req.params.tenderId));
    res.json({ offers });
  } catch (err) { next(err); }
};

export const getMy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = getCompanyId(req, res); if (!companyId) return;
    if (!req.userTenantId) {
      res.status(403).json({ error: 'Taşeron bağlamı yok', code: 'NO_TENANT' });
      return;
    }
    const offer = await repo.findByTenderAndTenant(companyId, String(req.params.tenderId), req.userTenantId);
    res.json({ offer });
  } catch (err) { next(err); }
};

export const getComparison = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = getCompanyId(req, res); if (!companyId) return;
    const comparison = await repo.getOfferComparison(companyId, String(req.params.tenderId));
    res.json(comparison);
  } catch (err) { next(err); }
};

export const upsert = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = getCompanyId(req, res); if (!companyId) return;
    if (!req.userTenantId) {
      res.status(403).json({ error: 'Taşeron bağlamı yok', code: 'NO_TENANT' });
      return;
    }
    const offer = await repo.upsert(companyId, String(req.params.tenderId), req.userTenantId);
    res.json({ offer });
  } catch (err) { next(err); }
};

export const getOfferItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = getCompanyId(req, res); if (!companyId) return;
    const items = await repo.findOfferItems(companyId, String(req.params.offerId));
    res.json({ items });
  } catch (err) { next(err); }
};

export const bulkUpdateItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = getCompanyId(req, res); if (!companyId) return;
    const parsed = bulkUpdateOfferItemsSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası', code: 'VALIDATION_ERROR' }); return; }
    const offerId = String(req.params.offerId);
    for (const item of parsed.data.items) {
      await repo.upsertOfferItem(companyId, offerId, item.itemId, item.materialUnitPrice, item.laborUnitPrice);
    }
    res.json({ status: 'ok' });
  } catch (err) { next(err); }
};

export const submit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = getCompanyId(req, res); if (!companyId) return;
    const offer = await repo.updateStatus(companyId, String(req.params.offerId), 'submitted');
    if (!offer) { res.status(404).json({ error: 'Teklif bulunamadı', code: 'NOT_FOUND' }); return; }
    res.json({ offer });
  } catch (err) { next(err); }
};

export const approve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = getCompanyId(req, res); if (!companyId) return;
    const parsed = reviewOfferSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası', code: 'VALIDATION_ERROR' }); return; }
    const offer = await repo.updateStatus(companyId, String(req.params.offerId), 'approved', req.userId, parsed.data.notes);
    if (!offer) { res.status(404).json({ error: 'Teklif bulunamadı', code: 'NOT_FOUND' }); return; }
    res.json({ offer });
  } catch (err) { next(err); }
};

export const reject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = getCompanyId(req, res); if (!companyId) return;
    const parsed = reviewOfferSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası', code: 'VALIDATION_ERROR' }); return; }
    const offer = await repo.updateStatus(companyId, String(req.params.offerId), 'rejected', req.userId, parsed.data.notes);
    if (!offer) { res.status(404).json({ error: 'Teklif bulunamadı', code: 'NOT_FOUND' }); return; }
    res.json({ offer });
  } catch (err) { next(err); }
};
