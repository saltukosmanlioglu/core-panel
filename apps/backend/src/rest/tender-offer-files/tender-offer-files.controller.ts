import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { TenantDb } from '../../lib/tenantDb';
import { UPLOADS_DIR } from '../../config/paths';
import { AppError } from '../../lib/AppError';
import { ALLOWED_MIME_TYPES, uploadOfferFileSchema } from '../../models/tender-offer-file.model';
import * as tendersRepo from '../tenders/tenders.repo';
import * as tenantsRepo from '../tenants/tenants.repo';
import * as tenderInvitationsRepo from '../tender-invitations/tender-invitations.repo';
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
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    cb(null, `${randomUUID()}${path.extname(file.originalname)}`);
  },
});

export const offerFileUpload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_MIME_TYPES)[number])) {
      cb(new AppError('Unsupported file type', 400, 'UNSUPPORTED_FILE_TYPE'));
      return;
    }

    cb(null, true);
  },
  limits: {
    fileSize: 25 * 1024 * 1024,
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

export const upload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const uploadedFilePath = req.file?.path;

  try {
    if (!req.file) {
      res.status(400).json({ error: 'File is required', code: 'FILE_REQUIRED' });
      return;
    }

    const parsed = uploadOfferFileSchema.safeParse(req.body);

    if (!parsed.success) {
      safeUnlink(uploadedFilePath ?? '');
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Validation failed',
        code: 'VALIDATION_ERROR',
      });
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

    const tenant = await tenantsRepo.findById(parsed.data.tenantId);
    if (!tenant || tenant.companyId !== companyId) {
      safeUnlink(uploadedFilePath ?? '');
      res.status(400).json({ error: 'Tenant not found for this company', code: 'INVALID_TENANT' });
      return;
    }

    const invitedTenantIds = await tenderInvitationsRepo.findByTenderId(new TenantDb(companyId), tenderId);
    if (!invitedTenantIds.includes(parsed.data.tenantId)) {
      safeUnlink(uploadedFilePath ?? '');
      res.status(400).json({ error: 'Tenant is not invited to this tender', code: 'TENANT_NOT_INVITED' });
      return;
    }

    const tdb = new TenantDb(companyId);
    const existing = await tenderOfferFilesRepo.findByTenderAndTenant(tdb, tenderId, parsed.data.tenantId);

    const offerFile = await tenderOfferFilesRepo.upsert(tdb, {
      tenderId,
      tenantId: parsed.data.tenantId,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      filePath: `/uploads/${req.file.filename}`,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedBy: req.userId!,
    });

    if (existing && existing.storedName !== offerFile.storedName) {
      safeUnlink(path.join(UPLOADS_DIR, existing.storedName));
    }

    res.status(201).json({
      offerFile: {
        ...offerFile,
        tenantName: tenant.name,
      },
    });
  } catch (error) {
    safeUnlink(uploadedFilePath ?? '');
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.resolvedCompanyId!;
    const tenderId = String(req.params.tenderId);
    const tenantId = String(req.params.tenantId);
    const tender = await tendersRepo.findById(companyId, tenderId);

    if (!tender) {
      res.status(404).json({ error: 'İhale bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const offerFile = await tenderOfferFilesRepo.remove(new TenantDb(companyId), tenderId, tenantId);

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
