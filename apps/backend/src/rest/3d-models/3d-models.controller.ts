import { NextFunction, Request, Response } from 'express';
import { getTdb } from '../../lib/tenantDb';
import {
  generateThreeDModelFromImageSchema,
  generateThreeDModelImageSchema,
  updateThreeDModelStatusSchema,
} from '../../models/three-d-model.model';
import * as projectsRepo from '../projects/projects.repo';
import * as repo from './3d-models.repo';
import * as service from './3d-models.service';

function getRequestBaseUrl(req: Request): string {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto?.split(',')[0]?.trim() || req.protocol;
  return `${protocol}://${req.get('host')}`;
}

function toPublicUrl(req: Request, value: string | null): string | null {
  if (!value) {
    return null;
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  return `${getRequestBaseUrl(req)}${value.startsWith('/') ? value : `/${value}`}`;
}

function withPublicModelUrl(req: Request, model: repo.ThreeDModelRecord): repo.ThreeDModelRecord {
  return {
    ...model,
    modelUrl: toPublicUrl(req, model.filePath),
  };
}

async function ensureProjectExists(req: Request, res: Response): Promise<boolean> {
  const project = await projectsRepo.findById(req.resolvedCompanyId!, String(req.params.projectId));

  if (!project) {
    res.status(404).json({ error: 'İnşaat bulunamadı', code: 'NOT_FOUND' });
    return false;
  }

  return true;
}

export const generateImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!(await ensureProjectExists(req, res))) {
      return;
    }

    const parsed = generateThreeDModelImageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const model = await service.generateImages(getTdb(req), String(req.params.projectId), parsed.data);

    res.status(201).json({
      id: model.id,
      imageTaskId: model.imageTaskId,
      imageUrls: model.previewImageUrls,
    });
  } catch (error) {
    next(error);
  }
};

export const createFromFloorPlanImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!(await ensureProjectExists(req, res))) {
      return;
    }

    const { z } = await import('zod');
    const schema = z.object({
      imageUrl: z.string().url(),
      floorPlanExportId: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const model = await repo.createFromFloorPlanImage(getTdb(req), {
      projectId: String(req.params.projectId),
      imageUrl: parsed.data.imageUrl,
      floorPlanExportId: parsed.data.floorPlanExportId,
    });

    res.status(201).json(withPublicModelUrl(req, model));
  } catch (error) {
    next(error);
  }
};

export const generate3d = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = generateThreeDModelFromImageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const model = await service.generateModelFromImage(getTdb(req), String(req.params.id), parsed.data.selectedImageUrl);

    res.json({
      id: model.id,
      meshyTaskId: model.meshyTaskId,
      status: model.generationStep,
    });
  } catch (error) {
    next(error);
  }
};

export const status = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const model = await service.syncStatus(getTdb(req), String(req.params.id), req.userId!);
    res.json(withPublicModelUrl(req, model));
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = updateThreeDModelStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Doğrulama hatası',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const model = await repo.updateGenerationStatus(getTdb(req), String(req.params.id), {
      generationStep: parsed.data.status,
      progress: parsed.data.status === repo.GENERATION_STEP.FAILED ? 0 : undefined,
    });

    if (!model) {
      res.status(404).json({ error: '3D model bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    res.json(withPublicModelUrl(req, model));
  } catch (error) {
    next(error);
  }
};

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!(await ensureProjectExists(req, res))) {
      return;
    }

    const models = await repo.findByProjectId(getTdb(req), String(req.params.projectId));
    res.json({ models: models.map((model) => withPublicModelUrl(req, model)) });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const model = await repo.remove(getTdb(req), String(req.params.id));

    if (!model) {
      res.status(404).json({ error: '3D model bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    await service.deleteLocalFile(model.filePath);
    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
};
