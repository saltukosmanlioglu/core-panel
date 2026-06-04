import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { NextFunction, Request, Response } from 'express';
import { UPLOADS_DIR } from '../../config/paths';
import { AppError } from '../../lib/AppError';
import * as projectsRepo from '../projects/projects.repo';
import * as tkgmService from '../../services/tkgm.service';
import * as repo from './parcel-calculations.repo';
import {
  calculateFootprint,
  calculatePolygonArea,
  calculateVertices,
  extractFullZoningInfo,
  extractParcelDocumentByType,
  extractSetbacksFromDocuments,
  type EdgeRole,
  type Edge,
  type Overhang,
  type ParcelDocumentType,
  type Point,
  type Setbacks,
} from './parcel-calculations.service';

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const MIME_TO_EXTENSIONS: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
};

function mimeMatchesExtension(mime: string, filename: string): boolean {
  const allowedExts = MIME_TO_EXTENSIONS[mime];
  if (!allowedExts) return false;
  const ext = path.extname(filename).replace('.', '').toLowerCase();
  return allowedExts.includes(ext);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.promises.mkdir(UPLOADS_DIR, { recursive: true })
      .then(() => cb(null, UPLOADS_DIR))
      .catch((err: unknown) => cb(err as Error, UPLOADS_DIR));
  },
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  },
});

export const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (!mimeMatchesExtension(file.mimetype, file.originalname)) {
      cb(new AppError('Geçersiz dosya türü. PDF, Word veya görsel yükleyin', 400, 'INVALID_FILE_TYPE'));
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 2,
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

function roundArea(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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

function requiredText(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError(`${fieldName} zorunludur`, 400, 'VALIDATION_ERROR');
  }

  return value.trim();
}

function optionalText(value: unknown, fallback: string | null): string | null {
  if (value === undefined) return fallback;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function positiveInteger(value: unknown, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(`${fieldName} geçersiz`, 400, 'VALIDATION_ERROR');
  }

  return parsed;
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

function documentExtractedOrDefault(
  value: unknown,
  fallback: repo.ParcelDocumentExtracted | null,
): repo.ParcelDocumentExtracted | null {
  if (value === undefined) return fallback;
  if (value === null) return null;

  const record = asRecord(value);
  const entries = Object.entries(record)
    .map(([key, item]) => {
      if (item === null || typeof item === 'string' || typeof item === 'number') {
        return [key, item] as const;
      }
      return null;
    })
    .filter((entry): entry is readonly [string, string | number | null] => entry !== null);

  return entries.length > 0
    ? Object.fromEntries(entries)
    : null;
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
  const hasDirectParcelVertices = Array.isArray(body.parcelVertices) && body.parcelVertices.length >= 3;
  if (!hasDirectParcelVertices) {
    validateEdges(edges);
  }

  const floorCount = integerInRange(body.floorCount, existing?.floorCount ?? 4, 1, 30);
  const setbackSource = body.setbackSource === 'document' || body.setbackSource === 'manual'
    ? body.setbackSource
    : existing?.setbackSource ?? 'manual';
  const setbacks = normalizeSetbacks(body.setbacks ?? body, fallbackSetbacks);
  const overhangs = normalizeOverhangs(body.overhangs, floorCount, existing?.overhangs);
  const parcelVertices: Point[] =
    hasDirectParcelVertices
      ? (body.parcelVertices as Point[])
      : calculateVertices(edges);
  const activeEdges: boolean[] | undefined =
    Array.isArray(body.activeEdges) ? (body.activeEdges as boolean[]) : undefined;
  const parcelArea = calculatePolygonArea(parcelVertices);
  const edgeRoles: EdgeRole[] = Array.isArray(body.edgeRoles)
    ? (body.edgeRoles as EdgeRole[])
    : [];
  const resolvedEdgeRoles: EdgeRole[] = edgeRoles.length > 0
    ? edgeRoles
    : parcelVertices.map((_, index) => {
      const edgeCount = parcelVertices.length;
      const frontEdgeIndex = typeof body.frontEdgeIndex === 'number' ? body.frontEdgeIndex : 0;
      const relativeIndex = ((index - frontEdgeIndex) % edgeCount + edgeCount) % edgeCount;
      if (relativeIndex === 0) return 'front';
      if (relativeIndex === 2) return 'back';
      return 'side';
    });
  const footprintVertices = calculateFootprint(parcelVertices, setbacks, resolvedEdgeRoles, activeEdges);
  const footprintArea = calculatePolygonArea(footprintVertices);
  const kaks = typeof body.kaks === 'number' && body.kaks > 0 ? body.kaks : 1.5;
  const totalConstructionArea = roundArea(parcelArea * 1.3 * kaks);

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
    planNotlariFileUrl: optionalText(body.planNotlariFileUrl, existing?.planNotlariFileUrl ?? null),
    planNotlariExtracted: documentExtractedOrDefault(body.planNotlariExtracted, existing?.planNotlariExtracted ?? null),
    imarDurumuFileUrl: optionalText(body.imarDurumuFileUrl, existing?.imarDurumuFileUrl ?? null),
    imarDurumuExtracted: documentExtractedOrDefault(body.imarDurumuExtracted, existing?.imarDurumuExtracted ?? null),
    footprintArea,
    footprintVertices,
    floorCount,
    overhangs,
    totalConstructionArea,
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

type SetbackUploadField = 'file' | 'planNotes' | 'zoningDocument' | 'document' | 'imarDurumu';
type SetbackUploadFiles = Partial<Record<SetbackUploadField, Express.Multer.File[]>>;

function uploadedSetbackFiles(req: Request): SetbackUploadFiles {
  if (!req.files || Array.isArray(req.files)) return {};
  return req.files as SetbackUploadFiles;
}

function safeUnlinkMany(files: Array<Express.Multer.File | undefined>): void {
  files.forEach((file) => safeUnlink(file?.path));
}

function allUploadedSetbackFiles(files: SetbackUploadFiles): Express.Multer.File[] {
  return Object.values(files).flatMap((fieldFiles) => fieldFiles ?? []);
}

function documentTypeFrom(value: unknown): ParcelDocumentType | null {
  if (value === null || value === undefined || value === '') return null;
  if (value === 'plan_notlari' || value === 'imar_durumu') return value;

  throw new AppError('Belge tipi geçersiz', 400, 'VALIDATION_ERROR');
}

function fileForDocumentType(
  files: SetbackUploadFiles,
  documentType: ParcelDocumentType,
): Express.Multer.File | undefined {
  if (files.file?.[0]) return files.file[0];
  if (files.document?.[0]) return files.document[0];

  return documentType === 'plan_notlari'
    ? files.planNotes?.[0]
    : files.imarDurumu?.[0] ?? files.zoningDocument?.[0];
}

function isWordDocument(file: Express.Multer.File): boolean {
  return file.mimetype === 'application/msword'
    || file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

function uploadedFileUrl(file: Express.Multer.File): string {
  return `/uploads/${file.filename}`;
}

function tkgmError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const message = error instanceof Error ? error.message : 'TKGM sorgusu başarısız oldu';
  return new AppError(message, 502, 'TKGM_REQUEST_FAILED');
}

export const getTkgmProvinces = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await tkgmService.getProvinceList();
    res.json({ data });
  } catch (error) {
    next(tkgmError(error));
  }
};

export const getTkgmDistricts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const provinceId = positiveInteger(req.params.provinceId, 'İl');
    const data = await tkgmService.getDistrictList(provinceId);
    res.json({ data });
  } catch (error) {
    next(tkgmError(error));
  }
};

export const getTkgmNeighborhoods = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const districtId = positiveInteger(req.params.districtId, 'İlçe');
    const data = await tkgmService.getNeighborhoodList(districtId);
    res.json({ data });
  } catch (error) {
    next(tkgmError(error));
  }
};

export const fetchFromTkgm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.resolvedCompanyId!;
    const projectId = String(req.params.projectId);
    if (!(await ensureProject(companyId, projectId, res))) return;

    const body = asRecord(req.body);
    const neighborhoodId = positiveInteger(body.neighborhoodId, 'Mahalle');
    const blockNo = requiredText(body.blockNo, 'Ada no');
    const parcelNo = requiredText(body.parcelNo, 'Parsel no');
    let parcel: tkgmService.ParcelResult;
    try {
      parcel = await tkgmService.fetchParcel(neighborhoodId, blockNo, parcelNo);
    } catch (error) {
      throw tkgmError(error);
    }

    const parcelArea = parcel.area || calculatePolygonArea(parcel.vertices);

    res.json({
      id: '',
      area: parcelArea,
      info: parcel.info,
      edges: parcel.edges,
      parcelVertices: parcel.vertices,
      vertices: parcel.vertices,
      coordinates: parcel.coordinates,
    });
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.resolvedCompanyId!;
    const projectId = String(req.params.projectId);
    if (!(await ensureProject(companyId, projectId, res))) return;

    const existing = await repo.findByProjectId(companyId, projectId);
    if (existing.length >= 3) {
      const oldest = [...existing].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
      if (oldest) await repo.deleteById(companyId, oldest.id);
    }

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
  const files = uploadedSetbackFiles(req);
  const planNotes = files.planNotes?.[0] ?? files.document?.[0];
  const zoningDocument = files.zoningDocument?.[0];
  const uploadedFiles = allUploadedSetbackFiles(files);

  try {
    const companyId = req.resolvedCompanyId!;
    const projectId = String(req.params.projectId);
    if (!(await ensureProject(companyId, projectId, res))) {
      safeUnlinkMany(uploadedFiles);
      return;
    }

    if (!planNotes && !zoningDocument) {
      res.status(400).json({ error: 'Belge yükleyin', code: 'FILE_REQUIRED' });
      return;
    }

    const result = await extractSetbacksFromDocuments(planNotes?.path, zoningDocument?.path);
    res.json(result);
  } catch (error) {
    safeUnlinkMany(uploadedFiles);
    next(error);
  }
};

export const extractZoning = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const files = uploadedSetbackFiles(req);
  const imarDurumu = files.imarDurumu?.[0] ?? files.zoningDocument?.[0] ?? files.document?.[0];
  const planNotes = files.planNotes?.[0];
  const uploadedFiles = allUploadedSetbackFiles(files);

  try {
    const body = asRecord(req.body);
    const documentType = documentTypeFrom(body.documentType);
    const companyId = req.resolvedCompanyId!;
    const projectId = String(req.params.projectId);
    if (!(await ensureProject(companyId, projectId, res))) {
      safeUnlinkMany(uploadedFiles);
      return;
    }

    if (documentType) {
      const documentFile = fileForDocumentType(files, documentType);
      if (!documentFile) {
        safeUnlinkMany(uploadedFiles);
        res.status(400).json({ error: 'Belge yükleyin', code: 'FILE_REQUIRED' });
        return;
      }

      if (documentType === 'imar_durumu' && isWordDocument(documentFile)) {
        throw new AppError('İmar Durumu için PDF veya görsel yükleyin', 400, 'INVALID_FILE_TYPE');
      }

      const result = await extractParcelDocumentByType(documentFile.path, documentType);
      res.json({
        documentType,
        fields: result.fields,
        zoningInfo: result.zoningInfo,
        fileUrl: uploadedFileUrl(documentFile),
        originalName: documentFile.originalname,
      });
      return;
    }

    if (!imarDurumu && !planNotes) {
      res.status(400).json({ error: 'Belge yükleyin', code: 'FILE_REQUIRED' });
      return;
    }

    const result = await extractFullZoningInfo(imarDurumu?.path, planNotes?.path);
    res.json(result);
  } catch (error) {
    safeUnlinkMany(uploadedFiles);
    next(error);
  }
};
