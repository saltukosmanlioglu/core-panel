import { Request, Response, NextFunction } from 'express';
import * as projectsRepo from './projects.repo';
import { createProjectSchema, updateProjectSchema } from '../../models/project.model';

export const getAll = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const all = await projectsRepo.findAll();
    res.json({ projects: all });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const project = await projectsRepo.findById(String(req.params.id));
    if (!project) {
      res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ project });
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Validation failed', code: 'VALIDATION_ERROR' });
      return;
    }
    const project = await projectsRepo.create(parsed.data);
    res.status(201).json({ project });
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = updateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Validation failed', code: 'VALIDATION_ERROR' });
      return;
    }
    const project = await projectsRepo.update(String(req.params.id), parsed.data);
    if (!project) {
      res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ project });
  } catch (err) {
    next(err);
  }
};

export const deleteById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const deleted = await projectsRepo.deleteById(String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
};
