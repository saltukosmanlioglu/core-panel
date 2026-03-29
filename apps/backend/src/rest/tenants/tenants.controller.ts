import { Request, Response, NextFunction } from 'express';
import * as tenantsRepo from './tenants.repo';
import { createTenantSchema, updateTenantSchema } from '../../models/tenant.model';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let all;
    if (req.userTenantId) {
      // TENANT_ADMIN: only their own tenant
      const tenant = await tenantsRepo.findById(req.userTenantId);
      all = tenant ? [tenant] : [];
    } else if (req.userCompanyId) {
      all = await tenantsRepo.findAllByCompanyId(req.userCompanyId);
    } else {
      all = await tenantsRepo.findAll();
    }
    res.json({ tenants: all });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenant = await tenantsRepo.findById(String(req.params.id));
    if (!tenant) {
      res.status(404).json({ error: 'Taşeron bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    if (req.userTenantId && tenant.id !== req.userTenantId) {
      res.status(403).json({ error: 'Erişim reddedildi', code: 'FORBIDDEN' });
      return;
    } else if (!req.userTenantId && req.userCompanyId && tenant.companyId !== req.userCompanyId) {
      res.status(403).json({ error: 'Erişim reddedildi', code: 'FORBIDDEN' });
      return;
    }
    res.json({ tenant });
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = createTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası',
        code: 'VALIDATION_ERROR',
      });
      return;
    }
    // COMPANY_ADMIN: force companyId to their own company
    const companyId = req.userCompanyId ?? parsed.data.companyId;
    if (!companyId) {
      res.status(400).json({ error: 'Şirket zorunludur', code: 'VALIDATION_ERROR' });
      return;
    }
    const tenant = await tenantsRepo.create({ name: parsed.data.name, companyId });
    res.status(201).json({ tenant });
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = updateTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası',
        code: 'VALIDATION_ERROR',
      });
      return;
    }
    if (req.userCompanyId) {
      const existing = await tenantsRepo.findById(String(req.params.id));
      if (!existing || existing.companyId !== req.userCompanyId) {
        res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
        return;
      }
    }
    const tenant = await tenantsRepo.update(String(req.params.id), {
      name: parsed.data.name,
      // COMPANY_ADMIN cannot move tenants to a different company
      companyId: req.userCompanyId ? undefined : parsed.data.companyId,
    });
    if (!tenant) {
      res.status(404).json({ error: 'Taşeron bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    res.json({ tenant });
  } catch (err) {
    next(err);
  }
};

export const deleteById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.userCompanyId) {
      const existing = await tenantsRepo.findById(String(req.params.id));
      if (!existing || existing.companyId !== req.userCompanyId) {
        res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
        return;
      }
    }
    const deleted = await tenantsRepo.deleteById(String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Taşeron bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
};
