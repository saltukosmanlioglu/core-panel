import { Request, Response, NextFunction } from 'express';
import { TenantDb } from '../../lib/tenantDb';
import { createPropertyOwnerSchema, updatePropertyOwnerSchema } from '../../models/property-owner.model';
import * as projectsRepo from '../projects/projects.repo';
import * as repo from './property-owners.repo';

async function ensureProject(companyId: string, projectId: string, res: Response): Promise<boolean> {
  const project = await projectsRepo.findById(companyId, projectId);
  if (!project) {
    res.status(404).json({ error: 'İnşaat bulunamadı', code: 'NOT_FOUND' });
    return false;
  }
  return true;
}

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.resolvedCompanyId!;
    const projectId = String(req.params.projectId);
    if (!(await ensureProject(companyId, projectId, res))) return;
    const owners = await repo.findByProjectId(new TenantDb(companyId), projectId);
    res.json({ owners });
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = createPropertyOwnerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası', code: 'VALIDATION_ERROR' });
      return;
    }
    const companyId = req.resolvedCompanyId!;
    const projectId = String(req.params.projectId);
    if (!(await ensureProject(companyId, projectId, res))) return;
    const owner = await repo.create(new TenantDb(companyId), projectId, parsed.data);
    res.status(201).json({ owner });
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = updatePropertyOwnerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası', code: 'VALIDATION_ERROR' });
      return;
    }
    const owner = await repo.update(new TenantDb(req.resolvedCompanyId!), String(req.params.id), parsed.data);
    if (!owner) {
      res.status(404).json({ error: 'Tapu sahibi bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    res.json({ owner });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const deleted = await repo.remove(new TenantDb(req.resolvedCompanyId!), String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Tapu sahibi bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
};
