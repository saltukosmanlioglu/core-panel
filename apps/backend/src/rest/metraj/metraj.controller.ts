import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as repo from './metraj.repo';

const openingSchema = z.object({
  id: z.string(),
  type: z.enum(['door', 'french-balcony', 'window', 'other']),
  label: z.string(),
  width: z.number().min(0),
  height: z.number().min(0),
  quantity: z.number().min(0),
});

const roomSchema = z.object({
  id: z.string(),
  name: z.string(),
  length: z.number().min(0),
  width: z.number().min(0),
  ceilingHeight: z.number().min(0),
});

const floorTypeSchema = z.object({
  id: z.string(),
  label: z.string(),
  quantity: z.number().min(0),
  rooms: z.array(roomSchema),
  openings: z.array(openingSchema),
});

const concreteClassSchema = z.enum(['C20', 'C25', 'C30', 'C35', 'C40', 'C45']);

const roughSlabSchema = z.object({
  areaSqm: z.number().min(0),
  thicknessM: z.number().min(0),
  concreteClass: concreteClassSchema,
  unitPrice: z.number().min(0),
});

const roughBasementWallSchema = z.object({
  perimeterM: z.number().min(0),
  thicknessM: z.number().min(0),
  heightM: z.number().min(0),
  concreteClass: concreteClassSchema,
  unitPrice: z.number().min(0),
});

const roughColumnSchema = z.object({
  widthM: z.number().min(0),
  depthM: z.number().min(0),
  quantity: z.number().min(0),
  concreteClass: concreteClassSchema,
  unitPrice: z.number().min(0),
});

const roughBeamSchema = z.object({
  id: z.string(),
  label: z.string(),
  widthM: z.number().min(0),
  heightM: z.number().min(0),
  totalLengthM: z.number().min(0),
  concreteClass: concreteClassSchema,
  unitPrice: z.number().min(0),
});

const roughConstructionSchema = z.object({
  floorTypes: z.array(z.object({
    id: z.string(),
    key: z.enum(['basement', 'ground', 'upper']),
    label: z.string(),
    quantity: z.number().min(0),
    ceilingHeightM: z.number().min(0),
    slab: roughSlabSchema,
    basementWall: roughBasementWallSchema.optional(),
    column: roughColumnSchema,
    beams: z.array(roughBeamSchema),
  })),
});

const upsertSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  parcelCalculationId: z.string().uuid().nullable().optional(),
  floorTypes: z.array(floorTypeSchema),
  roughConstruction: roughConstructionSchema.nullable().optional(),
});

export const get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const projectId = String(req.params.projectId);
    const takeoff = await repo.findByProjectId(req.resolvedCompanyId!, projectId);
    res.json({ takeoff });
  } catch (err) {
    next(err);
  }
};

export const upsert = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const projectId = String(req.params.projectId);
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası', code: 'VALIDATION_ERROR' });
      return;
    }
    const takeoff = await repo.upsert(req.resolvedCompanyId!, projectId, {
      ...parsed.data,
      createdBy: req.userId ?? null,
    });
    res.json({ takeoff });
  } catch (err) {
    next(err);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const deleted = await repo.deleteById(req.resolvedCompanyId!, String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Metraj bulunamadı', code: 'NOT_FOUND' });
      return;
    }
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
};
