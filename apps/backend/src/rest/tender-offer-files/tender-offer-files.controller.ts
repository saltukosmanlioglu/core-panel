import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';
import { TenantDb } from '../../lib/tenantDb';
import { UPLOADS_DIR } from '../../config/paths';
import { AppError } from '../../lib/AppError';
import { ALLOWED_MIME_TYPES } from '../../models/tender-offer-file.model';
import * as tendersRepo from '../tenders/tenders.repo';
import * as tenderOfferFilesRepo from './tender-offer-files.repo';

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function safeUnlink(filePath: string): void {
  if (!filePath) {
    return;
  }

  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  },
});

export const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_MIME_TYPES)[number])) {
      cb(new AppError('Invalid file type. Allowed: xlsx, xls, pdf, doc, docx', 400, 'INVALID_FILE_TYPE'));
      return;
    }

    cb(null, true);
  },
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.resolvedCompanyId!;
    const tenderId = String(req.params.tenderId);
    const tender = await tendersRepo.findById(companyId, tenderId);

    if (!tender) {
      res.status(404).json({ error: 'İhale bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const offerFiles = await tenderOfferFilesRepo.findByTenderId(new TenantDb(companyId), tenderId);
    res.json({ offerFiles });
  } catch (error) {
    next(error);
  }
};

export const uploadFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const uploadedFilePath = req.file?.path;

  try {
    if (!req.file) {
      res.status(400).json({ error: 'File is required', code: 'FILE_REQUIRED' });
      return;
    }

    const companyId = req.resolvedCompanyId!;
    const tenderId = String(req.params.tenderId);
    const tender = await tendersRepo.findById(companyId, tenderId);

    if (!tender) {
      safeUnlink(uploadedFilePath ?? '');
      res.status(404).json({ error: 'İhale bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const tdb = new TenantDb(companyId);
    const offerFile = await tenderOfferFilesRepo.create(tdb, {
      tenderId,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      filePath: `/uploads/${req.file.filename}`,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedBy: req.userId!,
    });

    res.status(201).json({ offerFile });
  } catch (error) {
    safeUnlink(uploadedFilePath ?? '');
    next(error);
  }
};

export const removeFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.resolvedCompanyId!;
    const tenderId = String(req.params.tenderId);
    const fileId = String(req.params.fileId);
    const tender = await tendersRepo.findById(companyId, tenderId);

    if (!tender) {
      res.status(404).json({ error: 'İhale bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const offerFile = await tenderOfferFilesRepo.remove(new TenantDb(companyId), fileId);

    if (!offerFile) {
      res.status(404).json({ error: 'Dosya bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    safeUnlink(path.join(UPLOADS_DIR, offerFile.storedName));
    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
};
