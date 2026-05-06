import { Request, Response, NextFunction } from 'express';
import * as tenantsRepo from './tenants.repo';
import { createTenantSchema, updateTenantSchema } from '../../models/tenant.model';
import { TenantDb } from '../../lib/tenantDb';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const all = req.userCompanyId
      ? await tenantsRepo.findAllByCompanyId(req.userCompanyId)
      : await tenantsRepo.findAll();
    res.json({ tenants: all });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenant = await tenantsRepo.findByIdByCompanyId(req.resolvedCompanyId!, String(req.params.id));
    if (!tenant) {
      res.status(404).json({ error: 'Taşeron bulunamadı', code: 'NOT_FOUND' });
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
    const companyId = req.resolvedCompanyId ?? req.userCompanyId ?? parsed.data.companyId;
    if (!companyId) {
      res.status(400).json({ error: 'Şirket zorunludur', code: 'VALIDATION_ERROR' });
      return;
    }
    const tenant = await tenantsRepo.create({
      name: parsed.data.name,
      companyId,
      contactName: parsed.data.contactName,
      contactPhone: parsed.data.contactPhone,
    });
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
      const existing = await tenantsRepo.findByIdByCompanyId(req.resolvedCompanyId!, String(req.params.id));
      if (!existing) {
        res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
        return;
      }
    }
    const tenant = await tenantsRepo.update(String(req.params.id), {
      name: parsed.data.name,
      contactName: parsed.data.contactName,
      contactPhone: parsed.data.contactPhone,
      companyId: req.resolvedCompanyId!,
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
    const tenantId = String(req.params.id);

    const existing = await tenantsRepo.findByIdByCompanyId(req.resolvedCompanyId!, tenantId);
    if (!existing) {
      res.status(404).json({ error: 'Taşeron bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const tdb = new TenantDb(existing.companyId);
    await tdb.query(
      `DELETE FROM ${tdb.ref('tender_invitations')} WHERE tenant_id = $1`,
      [tenantId],
    );
    await tdb.query(
      `UPDATE ${tdb.ref('tender_award_items')} SET awarded_tenant_id = NULL WHERE awarded_tenant_id = $1`,
      [tenantId],
    );
    await tdb.query(`DELETE FROM ${tdb.ref('tenants')} WHERE id = $1`, [tenantId]);
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
};
