import { Request, Response, NextFunction } from 'express';
import * as projectsRepo from './projects.repo';
import * as tendersRepo from '../tenders/tenders.repo';
import * as auditRepo from '../tender-audit-logs/tender-audit-logs.repo';
import { TenantDb } from '../../lib/tenantDb';
import { createProjectSchema, updateProjectSchema, updateProjectStatusSchema } from '../../models/project.model';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const projects = req.resolvedCompanyId
      ? await projectsRepo.findAll(req.resolvedCompanyId)
      : await projectsRepo.findAllAcrossCompanies();
    res.json({ projects });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const project = req.resolvedCompanyId
      ? await projectsRepo.findById(req.resolvedCompanyId, String(req.params.id))
      : await projectsRepo.findByIdAcrossCompanies(String(req.params.id));
    if (!project) {
      res.status(404).json({ error: 'İnşaat bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    res.json({ project });
  } catch (err) {
    next(err);
  }
};

export const getSummaryCounts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const counts = await projectsRepo.getSummaryCounts(req.resolvedCompanyId!, String(req.params.id));
    if (!counts) {
      res.status(404).json({ error: 'İnşaat bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    res.json(counts);
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası', code: 'VALIDATION_ERROR' });
      return;
    }
    const project = await projectsRepo.create(req.resolvedCompanyId!, parsed.data);
    res.status(201).json({ project });
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = updateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası', code: 'VALIDATION_ERROR' });
      return;
    }
    const project = await projectsRepo.update(req.resolvedCompanyId!, String(req.params.id), parsed.data);
    if (!project) {
      res.status(404).json({ error: 'İnşaat bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    res.json({ project });
  } catch (err) {
    next(err);
  }
};

export const deleteById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const deleted = await projectsRepo.deleteById(req.resolvedCompanyId!, String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'İnşaat bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
};

export const updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = updateProjectStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası', code: 'VALIDATION_ERROR' });
      return;
    }

    const project = await projectsRepo.updateStatus(req.resolvedCompanyId!, String(req.params.id), {
      ...parsed.data,
      userId: req.userId!,
    });

    if (!project) {
      res.status(404).json({ error: 'İnşaat bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const tdb = new TenantDb(req.resolvedCompanyId!);
    const tenders = await tendersRepo.findAll(req.resolvedCompanyId!, { projectId: project.id });
    await Promise.all(tenders.map((tender) => auditRepo.create(tdb, tender.id, 'project_status_updated', {
      projectId: project.id,
      status: parsed.data.status,
      note: parsed.data.note ?? null,
    }, req.userId!)));

    res.json({ project });
  } catch (err) {
    next(err);
  }
};
