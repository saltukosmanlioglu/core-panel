import { Request, Response, NextFunction } from 'express';
import * as tendersRepo from './tenders.repo';
import { createTenderSchema, updateTenderSchema } from '../../models/tender.model';

export const getAll = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const all = await tendersRepo.findAll();
    res.json({ tenders: all });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tender = await tendersRepo.findById(String(req.params.id));
    if (!tender) {
      res.status(404).json({ error: 'Tender not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ tender });
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = createTenderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Validation failed', code: 'VALIDATION_ERROR' });
      return;
    }
    const { deadline, ...rest } = parsed.data;
    const tender = await tendersRepo.create({
      ...rest,
      deadline: deadline ? new Date(deadline) : undefined,
    });
    res.status(201).json({ tender });
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = updateTenderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Validation failed', code: 'VALIDATION_ERROR' });
      return;
    }
    const { deadline, ...rest } = parsed.data;
    const tender = await tendersRepo.update(String(req.params.id), {
      ...rest,
      ...(deadline !== undefined ? { deadline: deadline ? new Date(deadline) : null } : {}),
    });
    if (!tender) {
      res.status(404).json({ error: 'Tender not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ tender });
  } catch (err) {
    next(err);
  }
};

export const deleteById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const deleted = await tendersRepo.deleteById(String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Tender not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
};
