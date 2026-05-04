import { NextFunction, Request, Response } from 'express';
import { getTdb } from '../../lib/tenantDb';
import {
  floorplannerGenerateDrawingSchema,
  floorplannerProvisionSchema,
} from '../../models/floorplanner.model';
import * as floorPlanExportsRepo from '../floor-plan-exports/floor-plan-exports.repo';
import * as service from './floorplanner.service';

export const provisionProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = floorplannerProvisionSchema.safeParse(req.body ?? {});

    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const floorplanner = await service.provisionProject(
      req.resolvedCompanyId!,
      String(req.params.id),
      parsed.data,
      {
        userId: req.userId,
        email: req.userEmail,
      },
    );

    res.status(floorplanner.createdUser || floorplanner.createdProject ? 201 : 200).json({ floorplanner });
  } catch (error) {
    next(error);
  }
};

export const generateDrawing = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = floorplannerGenerateDrawingSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const drawing = await service.generateAndSendDrawing(
      req.resolvedCompanyId!,
      String(req.params.id),
      parsed.data,
      {
        userId: req.userId,
        email: req.userEmail,
      },
    );

    res.status(201).json({ drawing });
  } catch (error) {
    next(error);
  }
};

export const startExport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await service.startExport(req.resolvedCompanyId!, String(req.params.id));
    res.status(202).json({ export: result });
  } catch (error) {
    next(error);
  }
};

export const getExport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await service.getExport(String(req.params.exportId));

    if (result.status === 'done' && result.url) {
      try {
        await floorPlanExportsRepo.upsert(getTdb(req), {
          projectId: String(req.params.id),
          floorplannerExportId: String(req.params.exportId),
          imageUrl: result.url,
        });
      } catch {
        // Non-fatal: log but don't fail the response
        console.warn('[FloorPlanExports] Auto-save failed for export', req.params.exportId);
      }
    }

    res.json({ export: result });
  } catch (error) {
    next(error);
  }
};
