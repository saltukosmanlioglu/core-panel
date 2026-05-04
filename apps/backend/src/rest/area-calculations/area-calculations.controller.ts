import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';
import { getTdb } from '../../lib/tenantDb';
import { UPLOADS_DIR } from '../../config/paths';
import { AppError } from '../../lib/AppError';
import {
  analyzeAreaCalculationSchema,
  AREA_CALCULATION_FILE_MIME_TYPES,
} from '../../models/area-calculation.model';
import * as projectsRepo from '../projects/projects.repo';
import * as repo from './area-calculations.repo';
import { calculateResults, extractDataWithClaude } from './area-calculations.service';

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
    if (!AREA_CALCULATION_FILE_MIME_TYPES.includes(file.mimetype as (typeof AREA_CALCULATION_FILE_MIME_TYPES)[number])) {
      cb(new AppError('Geçersiz dosya türü. PDF veya görsel yükleyin', 400, 'INVALID_FILE_TYPE'));
      return;
    }

    cb(null, true);
  },
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 8,
  },
});

type AreaCalculationFiles = Partial<Record<'rolovesi' | 'eimar' | 'plan_notes' | 'other_files', Express.Multer.File[]>>;

function uploadedFiles(req: Request): AreaCalculationFiles {
  return (req.files ?? {}) as AreaCalculationFiles;
}

function flattenFiles(files: AreaCalculationFiles): Express.Multer.File[] {
  return [
    ...(files.rolovesi ?? []),
    ...(files.eimar ?? []),
    ...(files.plan_notes ?? []),
    ...(files.other_files ?? []),
  ];
}

function publicPath(file?: Express.Multer.File): string | null {
  return file ? `/uploads/${file.filename}` : null;
}

function publicPaths(files?: Express.Multer.File[]): string[] {
  return (files ?? []).map((file) => `/uploads/${file.filename}`);
}

function safeUnlink(filePath?: string | null): void {
  if (!filePath) return;
  const absolute = filePath.startsWith('/uploads/')
    ? path.join(UPLOADS_DIR, path.basename(filePath))
    : filePath;

  try {
    fs.unlinkSync(absolute);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

function safeUnlinkAll(files: Express.Multer.File[]): void {
  files.forEach((file) => safeUnlink(file.path));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Belge analizi tamamlanamadı';
}

async function ensureProject(req: Request, res: Response): Promise<boolean> {
  const project = await projectsRepo.findById(req.resolvedCompanyId!, String(req.params.projectId));

  if (!project) {
    res.status(404).json({ error: 'İnşaat bulunamadı', code: 'NOT_FOUND' });
    return false;
  }

  return true;
}

export const analyze = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const filesByField = uploadedFiles(req);
  const files = flattenFiles(filesByField);

  try {
    if (!(await ensureProject(req, res))) {
      safeUnlinkAll(files);
      return;
    }

    const parsed = analyzeAreaCalculationSchema.safeParse(req.body);
    if (!parsed.success) {
      safeUnlinkAll(files);
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    if (files.length === 0) {
      res.status(400).json({ error: 'En az bir belge yükleyin', code: 'FILE_REQUIRED' });
      return;
    }

    const tdb = getTdb(req);
    const calculation = await repo.createProcessing(tdb, {
      projectId: String(req.params.projectId),
      status: 'processing',
      rolovesiPath: publicPath(filesByField.rolovesi?.[0]),
      eimarPath: publicPath(filesByField.eimar?.[0]),
      planNotesPath: publicPath(filesByField.plan_notes?.[0]),
      otherFiles: publicPaths(filesByField.other_files),
      note: parsed.data.note,
      createdBy: req.userId!,
    });

    try {
      const extractedData = await extractDataWithClaude(files);
      const calculatedResults = calculateResults(extractedData);
      const warnings = extractedData.warnings;
      const completed = await repo.markCompleted(tdb, calculation.id, extractedData, calculatedResults, warnings);

      res.status(201).json({
        id: completed?.id ?? calculation.id,
        extractedData,
        calculatedResults,
        warnings,
      });
    } catch (error) {
      await repo.markFailed(tdb, calculation.id, getErrorMessage(error));
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

export const getLatest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!(await ensureProject(req, res))) {
      return;
    }

    const calculation = await repo.findLatest(getTdb(req), String(req.params.projectId));
    res.json({ calculation });
  } catch (error) {
    next(error);
  }
};

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!(await ensureProject(req, res))) {
      return;
    }

    const calculations = await repo.findByProjectId(getTdb(req), String(req.params.projectId));
    res.json({ calculations });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const calculation = await repo.findById(getTdb(req), String(req.params.id));

    if (!calculation) {
      res.status(404).json({ error: 'Analiz bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    res.json({ calculation });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const calculation = await repo.remove(getTdb(req), String(req.params.id));

    if (!calculation) {
      res.status(404).json({ error: 'Analiz bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    [
      calculation.rolovesiPath,
      calculation.eimarPath,
      calculation.planNotesPath,
      ...calculation.otherFiles,
    ].forEach((filePath) => safeUnlink(filePath));

    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
};
