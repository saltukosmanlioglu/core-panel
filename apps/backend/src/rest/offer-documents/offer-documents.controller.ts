import { Request, Response, NextFunction } from 'express';
import { TenantDb } from '../../lib/tenantDb';
import { AppError } from '../../lib/AppError';
import { generateOfferPDF } from './pdf/pdf-generator';
import * as repo from './offer-documents.repo';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function requiredText(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError(`${fieldName} zorunludur`, 400, 'VALIDATION_ERROR');
  }
  return value.trim();
}

function textOrDefault(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function validDate(value: unknown): string {
  const raw = requiredText(value, 'Teklif tarihi');
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new AppError('Teklif tarihi geçersiz', 400, 'VALIDATION_ERROR');
  }
  return date.toISOString().slice(0, 10);
}

function buildInput(bodyValue: unknown): repo.OfferDocumentInput {
  const body = asRecord(bodyValue);
  return {
    parcelTitle: requiredText(body.parcelTitle, 'Parsel başlığı'),
    offerDate: validDate(body.offerDate),
    page2Content: requiredText(body.page2Content, 'Teklif içeriği'),
    tcmbRate: textOrDefault(body.tcmbRate, '1 Dolar (USD): 45,45 TL'),
    companyName: textOrDefault(body.companyName, ''),
    building: body.building as repo.OfferBuilding,
  };
}

async function projectExists(tdb: TenantDb, projectId: string): Promise<boolean> {
  const { rows } = await tdb.query<{ id: string }>(
    `SELECT id FROM ${tdb.ref('projects')} WHERE id = $1 LIMIT 1`,
    [projectId],
  );
  return rows.length > 0;
}

function tenantDb(req: Request): TenantDb {
  return new TenantDb(req.resolvedCompanyId!);
}

async function ensureProject(req: Request, res: Response): Promise<TenantDb | null> {
  const tdb = tenantDb(req);
  if (!(await projectExists(tdb, String(req.params.projectId)))) {
    res.status(404).json({ error: 'İnşaat bulunamadı', code: 'NOT_FOUND' });
    return null;
  }
  return tdb;
}

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tdb = await ensureProject(req, res);
    if (!tdb) return;

    const offerDocuments = await repo.findByProjectId(tdb, String(req.params.projectId));
    res.json({ offerDocuments });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tdb = await ensureProject(req, res);
    if (!tdb) return;

    const offerDocument = await repo.findById(tdb, String(req.params.projectId), String(req.params.id));
    if (!offerDocument) {
      res.status(404).json({ error: 'Teklif dokümanı bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    res.json({ offerDocument });
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tdb = await ensureProject(req, res);
    if (!tdb) return;

    const offerDocument = await repo.create(tdb, String(req.params.projectId), buildInput(req.body));
    res.status(201).json({ offerDocument });
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tdb = await ensureProject(req, res);
    if (!tdb) return;

    const offerDocument = await repo.update(tdb, String(req.params.projectId), String(req.params.id), buildInput(req.body));
    if (!offerDocument) {
      res.status(404).json({ error: 'Teklif dokümanı bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    res.json({ offerDocument });
  } catch (error) {
    next(error);
  }
};

export const deleteById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tdb = await ensureProject(req, res);
    if (!tdb) return;

    const deleted = await repo.deleteById(tdb, String(req.params.projectId), String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Teklif dokümanı bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
};

export const generatePdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tdb = await ensureProject(req, res);
    if (!tdb) return;

    const offerDocument = await repo.findById(tdb, String(req.params.projectId), String(req.params.id));
    if (!offerDocument) {
      res.status(404).json({ error: 'Teklif dokümanı bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const pdf = await generateOfferPDF(offerDocument);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="teklif-${offerDocument.id}.pdf"`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
};

export const getParcelArea = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tdb = await ensureProject(req, res);
    if (!tdb) return;

    const parcelArea = await repo.getParcelCalculationArea(tdb, String(req.params.projectId));
    res.json({ parcelArea });
  } catch (error) {
    next(error);
  }
};
