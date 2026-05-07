import { Request, Response, NextFunction } from 'express';
import { getTdb } from '../../lib/tenantDb';
import { AppError } from '../../lib/AppError';
import * as projectsRepo from '../projects/projects.repo';
import * as repo from './floor-plans.repo';
import * as sh3do from '../../services/sh3do.service';
import * as areaCalcRepo from '../area-calculations/area-calculations.repo';
import { generateFloorPlanXml } from '../../services/floor-plan-generator.service';

async function ensureProject(req: Request, res: Response): Promise<boolean> {
  const project = await projectsRepo.findById(req.resolvedCompanyId!, String(req.params.projectId));
  if (!project) {
    res.status(404).json({ error: 'İnşaat bulunamadı', code: 'NOT_FOUND' });
    return false;
  }
  return true;
}

function editorUrlOrNull(userId: string | null, homeName: string | null): string | null {
  if (!sh3do.isSh3doConfigured() || !userId || !homeName) return null;
  return sh3do.getEditorUrl(userId, homeName);
}

async function trySh3doUpload(userId: string, homeName: string, xml: string): Promise<void> {
  if (!sh3do.isSh3doConfigured()) return;
  try {
    await sh3do.createHome(userId, homeName, xml);
  } catch {
    console.warn('[FloorPlans] SH3D upload failed — floor plan saved without editor link');
  }
}

export const generate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!(await ensureProject(req, res))) return;

    const tdb = getTdb(req);
    const companyId = req.resolvedCompanyId!;
    const projectId = String(req.params.projectId);

    const { apartmentCount, roomType, name, floorNumber } = req.body as {
      apartmentCount?: number;
      roomType?: string;
      name?: string;
      floorNumber?: number;
    };

    if (!apartmentCount || !roomType) {
      res.status(400).json({ error: 'apartmentCount ve roomType zorunludur', code: 'VALIDATION_ERROR' });
      return;
    }

    const project = await projectsRepo.findById(companyId, projectId);
    if (!project) {
      res.status(404).json({ error: 'İnşaat bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const latestCalc = await areaCalcRepo.findLatest(tdb, projectId);
    const results = latestCalc?.calculatedResults as Record<string, number> | null | undefined;

    const totalArea = results?.max_taban_oturumu_max ?? results?.max_taban_oturumu_min ?? 100;
    const constraints = results
      ? {
          onBahce: results.on_bahce ?? null,
          yanBahce: results.yan_bahce ?? null,
          arkaBahce: results.arka_bahce ?? null,
        }
      : undefined;

    const aiPrompt = `${project.name} - ${roomType} x${apartmentCount} - Kat ${floorNumber ?? 1}`;

    const xml = await generateFloorPlanXml({
      totalArea,
      apartmentCount,
      roomType,
      projectName: project.name,
      constraints,
    });

    const userId = sh3do.generateUserId(companyId, projectId);
    const homeName = `fp_${projectId.replace(/-/g, '').slice(0, 8)}_${Date.now()}`;

    await trySh3doUpload(userId, homeName, xml);

    const floorPlan = await repo.createFloorPlan(tdb, {
      projectId,
      name: name ?? `${project.name} - Kat ${floorNumber ?? 1}`,
      floorNumber: floorNumber ?? 1,
      sh3doUserId: sh3do.isSh3doConfigured() ? userId : undefined,
      sh3doHomeName: sh3do.isSh3doConfigured() ? homeName : undefined,
      apartmentCount,
      roomType,
      totalArea,
      aiPrompt,
      aiGeneratedXml: xml,
      status: 'ready',
      createdBy: req.userId!,
    });

    const editorUrl = editorUrlOrNull(floorPlan.sh3doUserId, floorPlan.sh3doHomeName);
    res.status(201).json({ floorPlan, editorUrl });
  } catch (error) {
    next(error);
  }
};

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!(await ensureProject(req, res))) return;

    const floorPlans = await repo.findByProjectId(getTdb(req), String(req.params.projectId));

    const withUrls = floorPlans.map((fp) => ({
      ...fp,
      editorUrl: editorUrlOrNull(fp.sh3doUserId, fp.sh3doHomeName),
    }));

    res.json({ floorPlans: withUrls });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const floorPlan = await repo.findById(getTdb(req), String(req.params.id));

    if (!floorPlan) {
      res.status(404).json({ error: 'Kat planı bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    res.json({ floorPlan, editorUrl: editorUrlOrNull(floorPlan.sh3doUserId, floorPlan.sh3doHomeName) });
  } catch (error) {
    next(error);
  }
};

export const downloadXml = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const floorPlan = await repo.findById(getTdb(req), String(req.params.id));

    if (!floorPlan) {
      res.status(404).json({ error: 'Kat planı bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const xml = floorPlan.aiGeneratedXml;
    if (!xml) {
      res.status(404).json({ error: 'XML verisi bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const safeName = floorPlan.name.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s-]/g, '').trim() || 'kat-plani';
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.sh3d"`);
    res.send(xml);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tdb = getTdb(req);
    const floorPlan = await repo.findById(tdb, String(req.params.id));

    if (!floorPlan) {
      res.status(404).json({ error: 'Kat planı bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    if (sh3do.isSh3doConfigured() && floorPlan.sh3doUserId && floorPlan.sh3doHomeName) {
      await sh3do.deleteHome(floorPlan.sh3doUserId, floorPlan.sh3doHomeName);
    }

    await repo.deleteFloorPlan(tdb, floorPlan.id);
    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
};

export const regenerate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tdb = getTdb(req);
    const companyId = req.resolvedCompanyId!;
    const floorPlan = await repo.findById(tdb, String(req.params.id));

    if (!floorPlan) {
      res.status(404).json({ error: 'Kat planı bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    if (!floorPlan.apartmentCount || !floorPlan.roomType) {
      throw new AppError('Kat planı parametreleri eksik', 400, 'MISSING_PARAMS');
    }

    const project = await projectsRepo.findById(companyId, floorPlan.projectId);
    if (!project) {
      res.status(404).json({ error: 'İnşaat bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const xml = await generateFloorPlanXml({
      totalArea: floorPlan.totalArea ?? 100,
      apartmentCount: floorPlan.apartmentCount,
      roomType: floorPlan.roomType,
      projectName: project.name,
    });

    const userId = floorPlan.sh3doUserId ?? sh3do.generateUserId(companyId, floorPlan.projectId);
    const homeName = floorPlan.sh3doHomeName ?? `fp_${floorPlan.projectId.replace(/-/g, '').slice(0, 8)}_${Date.now()}`;

    await trySh3doUpload(userId, homeName, xml);

    const updated = await repo.updateFloorPlan(tdb, floorPlan.id, {
      sh3doUserId: sh3do.isSh3doConfigured() ? userId : undefined,
      sh3doHomeName: sh3do.isSh3doConfigured() ? homeName : undefined,
      aiGeneratedXml: xml,
      status: 'ready',
    });

    res.json({ floorPlan: updated, editorUrl: editorUrlOrNull(updated?.sh3doUserId ?? null, updated?.sh3doHomeName ?? null) });
  } catch (error) {
    next(error);
  }
};
