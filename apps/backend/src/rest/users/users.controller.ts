import { Request, Response, NextFunction } from 'express';
import * as usersRepo from './users.repo';
import * as usersService from './users.service';
import { createUserSchema, updateUserSchema } from '../../models/user.model';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = await usersRepo.findAllByCompanyId(req.userCompanyId!);
    res.json({ users });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await usersRepo.findById(String(req.params.id));
    if (!user) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    if (user.companyId !== req.userCompanyId) {
      res.status(403).json({ error: 'Erişim reddedildi', code: 'FORBIDDEN' });
      return;
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const user = await usersService.createUser({
      ...parsed.data,
      companyId: req.userCompanyId!,
      tenantId: null,
    });
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const existing = await usersRepo.findById(String(req.params.id));
    if (!existing) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    if (existing.companyId !== req.userCompanyId) {
      res.status(403).json({ error: 'Erişim reddedildi', code: 'FORBIDDEN' });
      return;
    }

    const user = await usersService.updateUser(
      String(req.params.id),
      {
        ...parsed.data,
        companyId: req.userCompanyId!,
        tenantId: null,
      },
      req.userId!
    );
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

export const deleteById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const existing = await usersRepo.findById(String(req.params.id));
    if (!existing) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    if (existing.companyId !== req.userCompanyId) {
      res.status(403).json({ error: 'Erişim reddedildi', code: 'FORBIDDEN' });
      return;
    }
    await usersService.deleteUser(String(req.params.id), req.userId!);
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
};
