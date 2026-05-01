import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';
import { TenantDb } from '../../lib/tenantDb';
import { UPLOADS_DIR } from '../../config/paths';
import { AppError } from '../../lib/AppError';
import { createPaymentPlanSchema, updatePaymentPlanSchema, payInstallmentSchema } from '../../models/payment-plan.model';
import * as propertyOwnersRepo from '../property-owners/property-owners.repo';
import * as repo from './payment-plans.repo';

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  },
});

export const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      cb(new AppError('Geçersiz dosya türü. İzin verilenler: PDF veya görüntü', 400, 'INVALID_FILE_TYPE'));
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

function safeUnlink(filePath?: string | null): void {
  if (!filePath) return;
  const absolute = filePath.startsWith('/uploads/')
    ? path.join(UPLOADS_DIR, path.basename(filePath))
    : filePath;
  try { fs.unlinkSync(absolute); } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

function publicPath(file?: Express.Multer.File): string | null {
  return file ? `/uploads/${file.filename}` : null;
}

async function ensureOwner(tdb: TenantDb, ownerId: string, res: Response): Promise<boolean> {
  const owner = await propertyOwnersRepo.findById(tdb, ownerId);
  if (!owner) {
    res.status(404).json({ error: 'Tapu sahibi bulunamadı', code: 'NOT_FOUND' });
    return false;
  }
  return true;
}

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tdb = new TenantDb(req.resolvedCompanyId!);
    const ownerId = String(req.params.ownerId);
    if (!(await ensureOwner(tdb, ownerId, res))) return;
    const plans = await repo.findByOwnerId(tdb, ownerId);
    res.json({ plans });
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = createPaymentPlanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası', code: 'VALIDATION_ERROR' });
      return;
    }
    const tdb = new TenantDb(req.resolvedCompanyId!);
    const ownerId = String(req.params.ownerId);
    const owner = await propertyOwnersRepo.findById(tdb, ownerId);
    if (!owner) {
      res.status(404).json({ error: 'Tapu sahibi bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    const plan = await repo.create(tdb, ownerId, owner.projectId, parsed.data);
    res.status(201).json({ plan });
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = updatePaymentPlanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası', code: 'VALIDATION_ERROR' });
      return;
    }
    const plan = await repo.update(new TenantDb(req.resolvedCompanyId!), String(req.params.id), parsed.data);
    if (!plan) {
      res.status(404).json({ error: 'Ödeme planı bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    res.json({ plan });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const deleted = await repo.remove(new TenantDb(req.resolvedCompanyId!), String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Ödeme planı bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
};

export const payInstallment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const uploaded = req.file?.path;
  try {
    const parsed = payInstallmentSchema.safeParse(req.body);
    if (!parsed.success) {
      safeUnlink(uploaded);
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası', code: 'VALIDATION_ERROR' });
      return;
    }
    const tdb = new TenantDb(req.resolvedCompanyId!);
    const planId = String(req.params.id);
    const installmentId = String(req.params.installmentId);

    const plan = await repo.findById(tdb, planId);
    if (!plan) {
      safeUnlink(uploaded);
      res.status(404).json({ error: 'Ödeme planı bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const installment = await repo.payInstallment(tdb, planId, installmentId, parsed.data, publicPath(req.file));
    if (!installment) {
      safeUnlink(uploaded);
      res.status(404).json({ error: 'Taksit bulunamadı veya zaten ödendi', code: 'NOT_FOUND' });
      return;
    }

    const updated = await repo.findById(tdb, planId);
    res.json({ installment, plan: updated });
  } catch (error) {
    safeUnlink(uploaded);
    next(error);
  }
};
