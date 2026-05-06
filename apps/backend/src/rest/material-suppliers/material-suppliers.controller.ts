import { Request, Response, NextFunction } from 'express';
import {
  createMaterialSupplierSchema,
  updateMaterialSupplierSchema,
} from '../../models/material-supplier.model';
import * as repo from './material-suppliers.repo';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const suppliers = await repo.findAll(req.userCompanyId!);
    res.json({ materialSuppliers: suppliers });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const supplier = await repo.findByIdByCompanyId(req.resolvedCompanyId!, String(req.params.id));
    if (!supplier) {
      res.status(404).json({ error: 'Malzemeci bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    res.json({ materialSupplier: supplier });
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = createMaterialSupplierSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const supplier = await repo.create(req.userCompanyId!, parsed.data);
    res.status(201).json({ materialSupplier: supplier });
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = updateMaterialSupplierSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const companyId = req.resolvedCompanyId!;
    const existing = await repo.findByIdByCompanyId(companyId, String(req.params.id));
    if (!existing) {
      res.status(404).json({ error: 'Malzemeci bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const supplier = await repo.update(companyId, String(req.params.id), parsed.data);
    res.json({ materialSupplier: supplier });
  } catch (err) {
    next(err);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.resolvedCompanyId!;
    const existing = await repo.findByIdByCompanyId(companyId, String(req.params.id));
    if (!existing) {
      res.status(404).json({ error: 'Malzemeci bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    await repo.remove(companyId, String(req.params.id));
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
};
