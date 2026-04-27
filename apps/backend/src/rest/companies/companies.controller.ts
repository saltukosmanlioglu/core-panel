import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';
import { UPLOADS_DIR } from '../../config/paths';
import { db } from '../../db/connection';
import { companies } from '../../db/schema';
import { AppError } from '../../lib/AppError';
import * as companiesRepo from './companies.repo';
import * as companiesService from './companies.service';

const LOGOS_DIR = path.join(UPLOADS_DIR, 'logos');

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(LOGOS_DIR)) fs.mkdirSync(LOGOS_DIR, { recursive: true });
    cb(null, LOGOS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo-${uuidv4()}${ext}`);
  },
});

export const logoUpload = multer({
  storage: logoStorage,
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new AppError('Only image files allowed', 400, 'INVALID_FILE_TYPE'));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const company = await companiesRepo.findById(req.userCompanyId!);
    res.json({ companies: company ? [company] : [] });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.userCompanyId && req.userCompanyId !== req.params.id) {
      res.status(403).json({ error: 'Erişim reddedildi', code: 'FORBIDDEN' });
      return;
    }
    const company = await companiesRepo.findById(String(req.params.id));
    if (!company) {
      res.status(404).json({ error: 'Şirket bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    res.json({ company });
  } catch (err) {
    next(err);
  }
};

export const reprovision = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.userCompanyId && req.userCompanyId !== req.params.id) {
      res.status(403).json({ error: 'Erişim reddedildi', code: 'FORBIDDEN' });
      return;
    }
    const company = await companiesService.reprovisionSchema(String(req.params.id));
    res.json({ company });
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.userCompanyId && req.userCompanyId !== req.params.id) {
      res.status(403).json({ error: 'Erişim reddedildi', code: 'FORBIDDEN' });
      return;
    }

    const { name } = req.body as { name?: unknown };
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Name is required', code: 'VALIDATION_ERROR' });
      return;
    }

    const [company] = await db
      .update(companies)
      .set({ name, updatedAt: new Date() })
      .where(eq(companies.id, String(req.params.id)))
      .returning();
    if (!company) {
      res.status(404).json({ error: 'Company not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ company });
  } catch (err) {
    next(err);
  }
};

export const uploadLogo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.userCompanyId && req.userCompanyId !== req.params.id) {
      res.status(403).json({ error: 'Erişim reddedildi', code: 'FORBIDDEN' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded', code: 'FILE_REQUIRED' });
      return;
    }

    const logoPath = `/uploads/logos/${req.file.filename}`;
    const [company] = await db
      .update(companies)
      .set({ logoPath, updatedAt: new Date() })
      .where(eq(companies.id, String(req.params.id)))
      .returning();
    if (!company) {
      res.status(404).json({ error: 'Company not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ company });
  } catch (err) {
    next(err);
  }
};
