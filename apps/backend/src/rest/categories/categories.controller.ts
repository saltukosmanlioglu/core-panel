import { Request, Response, NextFunction } from 'express';
import {
  createCategorySchema,
  updateCategorySchema,
  updateEntityCategoriesSchema,
} from '../../models/category.model';
import * as materialSuppliersRepo from '../material-suppliers/material-suppliers.repo';
import * as tenantsRepo from '../tenants/tenants.repo';
import * as repo from './categories.repo';
import { getTdb } from '../../lib/tenantDb';

async function ensureCategoryBelongsToCompany(categoryId: string, companyId: string): Promise<boolean> {
  const category = await repo.findById(categoryId);
  return !!category && category.companyId === companyId;
}

async function categoryIdsBelongToCompany(categoryIds: string[], companyId: string): Promise<boolean> {
  if (categoryIds.length === 0) return true;
  const companyCategories = await repo.findAll(companyId);
  const allowedCategoryIds = new Set(companyCategories.map((category) => category.id));
  return categoryIds.every((categoryId) => allowedCategoryIds.has(categoryId));
}

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await repo.findAll(req.userCompanyId!);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const category = await repo.findById(String(req.params.id));
    if (!category || category.companyId !== req.userCompanyId) {
      res.status(404).json({ error: 'Kategori bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    res.json(category);
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const category = await repo.create(req.userCompanyId!, parsed.data);
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = updateCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    if (!(await ensureCategoryBelongsToCompany(String(req.params.id), req.userCompanyId!))) {
      res.status(404).json({ error: 'Kategori bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const category = await repo.update(String(req.params.id), parsed.data);
    res.json(category);
  } catch (err) {
    next(err);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categoryId = String(req.params.id);

    if (!(await ensureCategoryBelongsToCompany(categoryId, req.userCompanyId!))) {
      res.status(404).json({ error: 'Kategori bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const tdb = getTdb(req);
    await tdb.query(
      `UPDATE ${tdb.ref('tenders')} SET category_id = NULL WHERE category_id = $1`,
      [categoryId],
    );

    await repo.remove(categoryId);
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
};

export const getTenantCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenant = await tenantsRepo.findById(String(req.params.tenantId));
    if (!tenant || tenant.companyId !== req.userCompanyId) {
      res.status(404).json({ error: 'Taşeron bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const categoryIds = await repo.findCategoriesByTenantId(String(req.params.tenantId));
    res.json({ categoryIds });
  } catch (err) {
    next(err);
  }
};

export const updateTenantCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = updateEntityCategoriesSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const tenant = await tenantsRepo.findById(String(req.params.tenantId));
    if (!tenant || tenant.companyId !== req.userCompanyId) {
      res.status(404).json({ error: 'Taşeron bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    if (!(await categoryIdsBelongToCompany(parsed.data.categoryIds, req.userCompanyId!))) {
      res.status(400).json({ error: 'Geçersiz kategori', code: 'VALIDATION_ERROR' });
      return;
    }

    await repo.replaceTenantCategories(String(req.params.tenantId), parsed.data.categoryIds);
    res.json({ categoryIds: parsed.data.categoryIds });
  } catch (err) {
    next(err);
  }
};

export const getSupplierCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const supplier = await materialSuppliersRepo.findById(String(req.params.supplierId));
    if (!supplier || supplier.companyId !== req.userCompanyId) {
      res.status(404).json({ error: 'Malzemeci bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const categoryIds = await repo.findCategoriesBySupplierId(String(req.params.supplierId));
    res.json({ categoryIds });
  } catch (err) {
    next(err);
  }
};

export const updateSupplierCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = updateEntityCategoriesSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const supplier = await materialSuppliersRepo.findById(String(req.params.supplierId));
    if (!supplier || supplier.companyId !== req.userCompanyId) {
      res.status(404).json({ error: 'Malzemeci bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    if (!(await categoryIdsBelongToCompany(parsed.data.categoryIds, req.userCompanyId!))) {
      res.status(400).json({ error: 'Geçersiz kategori', code: 'VALIDATION_ERROR' });
      return;
    }

    await repo.replaceSupplierCategories(String(req.params.supplierId), parsed.data.categoryIds);
    res.json({ categoryIds: parsed.data.categoryIds });
  } catch (err) {
    next(err);
  }
};

export const getTenantsByCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!(await ensureCategoryBelongsToCompany(String(req.params.categoryId), req.userCompanyId!))) {
      res.status(404).json({ error: 'Kategori bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const tenantIds = await repo.findTenantsByCategory(String(req.params.categoryId));
    res.json({ tenantIds });
  } catch (err) {
    next(err);
  }
};
