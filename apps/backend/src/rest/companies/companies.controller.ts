import { Request, Response, NextFunction } from 'express';
import * as companiesRepo from './companies.repo';
import * as companiesService from './companies.service';
import { createCompanySchema, updateCompanySchema } from '../../models/company.model';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.userCompanyId) {
      // COMPANY_ADMIN / TENANT_ADMIN: return only their own company
      const company = await companiesRepo.findById(req.userCompanyId);
      res.json({ companies: company ? [company] : [] });
    } else {
      // SUPER_ADMIN: return all
      const all = await companiesRepo.findAll();
      res.json({ companies: all });
    }
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.userCompanyId && req.userCompanyId !== req.params.id) {
      res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
      return;
    }
    const company = await companiesRepo.findById(String(req.params.id));
    if (!company) {
      res.status(404).json({ error: 'Company not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ company });
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = createCompanySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Validation failed',
        code: 'VALIDATION_ERROR',
      });
      return;
    }
    const company = await companiesService.createCompany({ name: parsed.data.name });
    res.status(201).json({ company });
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = updateCompanySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Validation failed',
        code: 'VALIDATION_ERROR',
      });
      return;
    }
    const company = await companiesRepo.update(String(req.params.id), { name: parsed.data.name });
    if (!company) {
      res.status(404).json({ error: 'Company not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ company });
  } catch (err) {
    next(err);
  }
};

export const deleteById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const deleted = await companiesService.deleteCompany(String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Company not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
};

export const reprovision = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const company = await companiesService.reprovisionSchema(String(req.params.id));
    res.json({ company });
  } catch (err) {
    next(err);
  }
};
