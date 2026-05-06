import { NextFunction, Request, Response } from 'express';
import { TenantDb } from '../../lib/tenantDb';
import * as projectsRepo from '../projects/projects.repo';
import * as repo from './rough-estimates.repo';
import {
  calculateAreas,
  calculateCostPerSqm,
  DEFAULT_OFFER_LETTER_CONTENT,
  DEFAULT_OFFER_LETTER_TITLE,
  generateExcel,
  generatePDF,
} from './rough-estimates.service';
import type { RoughEstimatePayload, RoughEstimateUnitPayload } from '@core-panel/shared';

async function ensureProject(companyId: string, projectId: string, res: Response): Promise<boolean> {
  const project = await projectsRepo.findById(companyId, projectId);
  if (!project) {
    res.status(404).json({ error: 'İnşaat bulunamadı', code: 'NOT_FOUND' });
    return false;
  }
  return true;
}

function numberOrNull(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function integerOrDefault(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function boolOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function textOrNull(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value);
  return text.length > 0 ? text : null;
}

function normalizePayload(body: Record<string, unknown>, userId?: string): RoughEstimatePayload {
  const payload: RoughEstimatePayload = {
    netParcelArea: numberOrNull(body.netParcelArea) ?? null,
    taksMin: numberOrNull(body.taksMin) ?? null,
    taksMax: numberOrNull(body.taksMax) ?? null,
    kaks: numberOrNull(body.kaks) ?? null,
    regulationBonusPercent: numberOrNull(body.regulationBonusPercent) ?? 30,
    basementArea: numberOrNull(body.basementArea) ?? 0,
    secondBasementArea: numberOrNull(body.secondBasementArea) ?? 0,
    thirdBasementArea: numberOrNull(body.thirdBasementArea) ?? 0,
    floorCount: integerOrDefault(body.floorCount, 0),
    unitsPerFloor: integerOrDefault(body.unitsPerFloor, 2),
    hasRoofUnit: boolOrDefault(body.hasRoofUnit, false),
    roofUnitArea: numberOrNull(body.roofUnitArea) ?? 0,
    totalConstructionCost: numberOrNull(body.totalConstructionCost) ?? null,
    currency: textOrNull(body.currency) ?? 'TRY',
    usdRate: numberOrNull(body.usdRate) ?? null,
    projectTitle: textOrNull(body.projectTitle) ?? null,
    offerValidUntil: textOrNull(body.offerValidUntil) ?? null,
    deliveryMonths: integerOrDefault(body.deliveryMonths, 10),
    offerLetterTitle: textOrNull(body.offerLetterTitle) ?? DEFAULT_OFFER_LETTER_TITLE,
    offerLetterContent: textOrNull(body.offerLetterContent) ?? DEFAULT_OFFER_LETTER_CONTENT,
    notes: textOrNull(body.notes) ?? null,
    status: textOrNull(body.status) ?? 'draft',
  };

  const areas = calculateAreas(payload);
  payload.minBaseArea = areas.minBaseArea;
  payload.maxBaseArea = areas.maxBaseArea;
  payload.maxConstructionArea = areas.maxConstructionArea;
  payload.regulationBonusArea = areas.regulationBonusArea;
  payload.totalBrutArea = areas.totalBrutArea;
  payload.costPerSqm = calculateCostPerSqm(payload.totalConstructionCost, payload.totalBrutArea);
  if (userId) payload.createdBy = userId;

  return payload;
}

function normalizeUnits(value: unknown): RoughEstimateUnitPayload[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): RoughEstimateUnitPayload | null => {
      if (!item || typeof item !== 'object') return null;
      const data = item as Record<string, unknown>;
      const floorNumber = integerOrDefault(data.floorNumber, 0);
      const unitNumber = integerOrDefault(data.unitNumber, 1);
      return {
        floorNumber,
        floorLabel: textOrNull(data.floorLabel) ?? null,
        unitNumber,
        block: textOrNull(data.block) ?? null,
        unitType: textOrNull(data.unitType) ?? 'apartment',
        ownerType: textOrNull(data.ownerType) ?? 'property_owner',
        ownerName: textOrNull(data.ownerName) ?? null,
        propertyOwnerId: textOrNull(data.propertyOwnerId) ?? null,
        grossArea: numberOrNull(data.grossArea) ?? null,
        fireEscapeArea: numberOrNull(data.fireEscapeArea) ?? 0,
        hasPayment: boolOrDefault(data.hasPayment, true),
        paymentAmount: numberOrNull(data.paymentAmount) ?? null,
        notes: textOrNull(data.notes) ?? null,
      };
    })
    .filter((item): item is RoughEstimateUnitPayload => item !== null);
}

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.resolvedCompanyId!;
    const projectId = String(req.params.projectId);
    if (!(await ensureProject(companyId, projectId, res))) return;

    const estimates = await repo.findByProject(new TenantDb(companyId), projectId);
    res.json({ estimates });
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.resolvedCompanyId!;
    const projectId = String(req.params.projectId);
    if (!(await ensureProject(companyId, projectId, res))) return;

    const tdb = new TenantDb(companyId);
    const estimate = await repo.create(tdb, projectId, normalizePayload(req.body as Record<string, unknown>, req.userId));
    const units = normalizeUnits((req.body as Record<string, unknown>).units);
    if (units.length > 0) await repo.upsertUnits(tdb, estimate.id, units);
    const saved = await repo.findByIdWithUnits(tdb, estimate.id);
    res.status(201).json({ estimate: saved });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const estimate = await repo.findByIdWithUnits(new TenantDb(req.resolvedCompanyId!), String(req.params.id));
    if (!estimate) {
      res.status(404).json({ error: 'Kaba hesap bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    res.json({ estimate });
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tdb = new TenantDb(req.resolvedCompanyId!);
    const estimate = await repo.update(tdb, String(req.params.id), normalizePayload(req.body as Record<string, unknown>));
    if (!estimate) {
      res.status(404).json({ error: 'Kaba hesap bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    if (Array.isArray(body.units)) {
      const units = normalizeUnits(body.units);
      await repo.upsertUnits(tdb, estimate.id, units);
    }

    const saved = await repo.findByIdWithUnits(tdb, estimate.id);
    res.json({ estimate: saved });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const deleted = await repo.deleteById(new TenantDb(req.resolvedCompanyId!), String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Kaba hesap bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
};

export const getUnits = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const units = await repo.findUnits(new TenantDb(req.resolvedCompanyId!), String(req.params.id));
    res.json({ units });
  } catch (error) {
    next(error);
  }
};

export const upsertUnits = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tdb = new TenantDb(req.resolvedCompanyId!);
    const estimate = await repo.findById(tdb, String(req.params.id));
    if (!estimate) {
      res.status(404).json({ error: 'Kaba hesap bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const units = normalizeUnits((req.body as Record<string, unknown>).units);
    const savedUnits = await repo.upsertUnits(tdb, estimate.id, units);
    res.json({ units: savedUnits });
  } catch (error) {
    next(error);
  }
};

export const exportPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tdb = new TenantDb(req.resolvedCompanyId!);
    const estimate = await repo.findByIdWithUnits(tdb, String(req.params.id));
    if (!estimate) {
      res.status(404).json({ error: 'Kaba hesap bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const buffer = await generatePDF(estimate, estimate.units);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="kaba-hesap-${estimate.id}.pdf"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

export const exportExcel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tdb = new TenantDb(req.resolvedCompanyId!);
    const estimate = await repo.findByIdWithUnits(tdb, String(req.params.id));
    if (!estimate) {
      res.status(404).json({ error: 'Kaba hesap bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const buffer = await generateExcel(estimate, estimate.units);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="kaba-hesap-${estimate.id}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};
