import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { NextFunction, Request, Response } from 'express';
import { UPLOADS_DIR } from '../../config/paths';
import { AppError } from '../../lib/AppError';
import * as projectsRepo from '../projects/projects.repo';
import * as repo from './parcel-calculations.repo';
import {
  calculateFootprint,
  calculateOverhangArea,
  calculatePolygonArea,
  calculateVertices,
  extractSetbacksFromDocument,
  type Edge,
  type Overhang,
  type Setbacks,
} from './parcel-calculations.service';

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

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
    const allowed = DOCUMENT_MIME_TYPES.includes(file.mimetype as (typeof DOCUMENT_MIME_TYPES)[number])
      || /\.(pdf|png|jpe?g|webp|gif)$/i.test(file.originalname);

    if (!allowed) {
      cb(new AppError('Geçersiz dosya türü. PDF veya görsel yükleyin', 400, 'INVALID_FILE_TYPE'));
      return;
    }

    cb(null, true);
  },
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1,
  },
});

async function ensureProject(companyId: string, projectId: string, res: Response): Promise<boolean> {
  const project = await projectsRepo.findById(companyId, projectId);
  if (!project) {
    res.status(404).json({ error: 'İnşaat bulunamadı', code: 'NOT_FOUND' });
    return false;
  }
  return true;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberFrom(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nonNegativeNumber(value: unknown, fallback = 0): number {
  return Math.max(0, numberFrom(value, fallback));
}

function integerInRange(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Math.trunc(numberFrom(value, fallback));
  return Math.min(max, Math.max(min, parsed));
}

function textOrDefault(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeEdges(value: unknown, fallback: Edge[] = []): Edge[] {
  if (!Array.isArray(value)) return fallback;

  return value.map((item, index) => {
    const record = asRecord(item);
    return {
      label: textOrDefault(record.label, String.fromCharCode(65 + index)),
      length: nonNegativeNumber(record.length),
      angle: numberFrom(record.angle, 90),
    };
  });
}

function normalizeSetbacks(value: unknown, fallback: Setbacks): Setbacks {
  const record = asRecord(value);
  return {
    front: nonNegativeNumber(record.front ?? record.setbackFront, fallback.front),
    back: nonNegativeNumber(record.back ?? record.setbackBack, fallback.back),
    left: nonNegativeNumber(record.left ?? record.setbackLeft, fallback.left),
    right: nonNegativeNumber(record.right ?? record.setbackRight, fallback.right),
  };
}

function defaultOverhangs(floorCount: number): Overhang[] {
  return Array.from({ length: floorCount }, (_, index) => {
    const floor = index + 1;
    const value = floor === 1 ? 0 : 1.5;
    return { floor, front: value, back: value, left: value, right: value };
  });
}

function normalizeOverhangs(value: unknown, floorCount: number, fallback?: Overhang[]): Overhang[] {
  const source = Array.isArray(value) ? value : fallback ?? defaultOverhangs(floorCount);
  const byFloor = new Map<number, Overhang>();

  source.forEach((item) => {
    const record = asRecord(item);
    const floor = integerInRange(record.floor, 1, 1, floorCount);
    const zeroOnGround = floor === 1;
    byFloor.set(floor, {
      floor,
      front: zeroOnGround ? 0 : nonNegativeNumber(record.front, 1.5),
      back: zeroOnGround ? 0 : nonNegativeNumber(record.back, 1.5),
      left: zeroOnGround ? 0 : nonNegativeNumber(record.left, 1.5),
      right: zeroOnGround ? 0 : nonNegativeNumber(record.right, 1.5),
    });
  });

  return Array.from({ length: floorCount }, (_, index) => {
    const floor = index + 1;
    return byFloor.get(floor) ?? (floor === 1
      ? { floor, front: 0, back: 0, left: 0, right: 0 }
      : { floor, front: 1.5, back: 1.5, left: 1.5, right: 1.5 });
  });
}

function validateEdges(edges: Edge[]): void {
  if (edges.length < 3) {
    throw new AppError('En az 3 kenar girin', 400, 'VALIDATION_ERROR');
  }

  const invalid = edges.find((edge) => edge.length <= 0 || edge.angle <= 0 || edge.angle >= 360);
  if (invalid) {
    throw new AppError('Kenar uzunlukları pozitif, iç açılar 1-359 derece arasında olmalıdır', 400, 'VALIDATION_ERROR');
  }
}

function buildCalculationData(
  body: Record<string, unknown>,
  existing?: repo.ParcelCalculation,
  userId?: string,
): repo.ParcelCalculationInput {
  const fallbackSetbacks: Setbacks = existing
    ? {
      front: existing.setbackFront,
      back: existing.setbackBack,
      left: existing.setbackLeft,
      right: existing.setbackRight,
    }
    : { front: 0, back: 0, left: 0, right: 0 };

  const edges = body.edges !== undefined ? normalizeEdges(body.edges, existing?.edges ?? []) : existing?.edges ?? [];
  validateEdges(edges);

  const floorCount = integerInRange(body.floorCount, existing?.floorCount ?? 4, 1, 30);
  const setbackSource = body.setbackSource === 'document' || body.setbackSource === 'manual'
    ? body.setbackSource
    : existing?.setbackSource ?? 'manual';
  const setbacks = normalizeSetbacks(body.setbacks ?? body, fallbackSetbacks);
  const overhangs = normalizeOverhangs(body.overhangs, floorCount, existing?.overhangs);
  const parcelVertices = calculateVertices(edges);
  const parcelArea = calculatePolygonArea(parcelVertices);
  const frontEdgeIndex = integerInRange(body.frontEdgeIndex, 0, 0, Math.max(0, edges.length - 1));
  const footprintVertices = calculateFootprint(parcelVertices, setbacks, frontEdgeIndex);
  const footprintArea = calculatePolygonArea(footprintVertices);
  const totalConstructionArea = overhangs.reduce(
    (sum, overhang) => sum + calculateOverhangArea(footprintVertices, overhang),
    0,
  );

  return {
    name: textOrDefault(body.name, existing?.name ?? 'Hesaplama'),
    edges,
    parcelArea,
    parcelVertices,
    setbackSource,
    setbackFront: setbacks.front,
    setbackBack: setbacks.back,
    setbackLeft: setbacks.left,
    setbackRight: setbacks.right,
    setbackDocumentPath: typeof body.setbackDocumentPath === 'string' ? body.setbackDocumentPath : existing?.setbackDocumentPath ?? null,
    setbackDocumentName: typeof body.setbackDocumentName === 'string' ? body.setbackDocumentName : existing?.setbackDocumentName ?? null,
    setbackRawText: typeof body.setbackRawText === 'string' ? body.setbackRawText : existing?.setbackRawText ?? null,
    footprintArea,
    footprintVertices,
    floorCount,
    overhangs,
    totalConstructionArea: Math.round((totalConstructionArea + Number.EPSILON) * 100) / 100,
    status: textOrDefault(body.status, existing?.status ?? 'completed'),
    createdBy: existing?.createdBy ?? userId ?? null,
  };
}

function safeUnlink(filePath?: string | null): void {
  if (!filePath) return;

  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.resolvedCompanyId!;
    const projectId = String(req.params.projectId);
    if (!(await ensureProject(companyId, projectId, res))) return;

    const data = buildCalculationData(req.body as Record<string, unknown>, undefined, req.userId);
    const calculation = await repo.create(companyId, projectId, data);
    res.status(201).json({ calculation });
  } catch (error) {
    next(error);
  }
};

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.resolvedCompanyId!;
    const projectId = String(req.params.projectId);
    if (!(await ensureProject(companyId, projectId, res))) return;

    const calculations = await repo.findByProjectId(companyId, projectId);
    res.json({ calculations });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const calculation = await repo.findById(req.resolvedCompanyId!, String(req.params.id));
    if (!calculation) {
      res.status(404).json({ error: 'Hesaplama bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    res.json({ calculation });
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.resolvedCompanyId!;
    const existing = await repo.findById(companyId, String(req.params.id));
    if (!existing) {
      res.status(404).json({ error: 'Hesaplama bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const data = buildCalculationData(req.body as Record<string, unknown>, existing, req.userId);
    const calculation = await repo.update(companyId, existing.id, data);
    res.json({ calculation });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const deleted = await repo.deleteById(req.resolvedCompanyId!, String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Hesaplama bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
};

export const extractSetbacks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const file = req.file;

  try {
    const companyId = req.resolvedCompanyId!;
    const projectId = String(req.params.projectId);
    if (!(await ensureProject(companyId, projectId, res))) {
      safeUnlink(file?.path);
      return;
    }

    if (!file) {
      res.status(400).json({ error: 'Belge yükleyin', code: 'FILE_REQUIRED' });
      return;
    }

    const setbacks = await extractSetbacksFromDocument(file.path);
    res.json(setbacks);
  } catch (error) {
    safeUnlink(file?.path);
    next(error);
  }
};
