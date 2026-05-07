import { TenantDb } from '../../lib/tenantDb';
import type { FloorPlanMetadata } from '@core-panel/shared';

export const GENERATION_STEP = {
  PENDING: 'PENDING',
  IMAGE_GENERATING: 'IMAGE_GENERATING',
  IMAGE_DONE: 'IMAGE_DONE',
  MODEL_GENERATING: 'MODEL_GENERATING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export type GenerationStep = (typeof GENERATION_STEP)[keyof typeof GENERATION_STEP];

interface ThreeDModelRow {
  id: string;
  project_id: string;
  name: string | null;
  meshy_task_id: string | null;
  status: string;
  generation_step: string | null;
  thumbnail_url: string | null;
  model_url: string | null;
  preview_image_urls: unknown;
  original_image_urls: unknown;
  selected_image_url: string | null;
  source_floor_plan_id: string | null;
  plan_metadata: unknown | null;
  prompt: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

function toGenerationStep(value: string | null): GenerationStep {
  return Object.values(GENERATION_STEP).includes(value as GenerationStep)
    ? (value as GenerationStep)
    : GENERATION_STEP.PENDING;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function mapRow(row: ThreeDModelRow) {
  const generationStep = toGenerationStep(row.generation_step ?? row.status);

  return {
    id: row.id,
    projectId: row.project_id,
    prompt: row.prompt ?? '',
    texturePrompt: null,
    enhancedPrompt: null,
    meshyTaskId: row.meshy_task_id,
    meshyTextureTaskId: null,
    imageTaskId: row.meshy_task_id,
    status: generationStep,
    generationStep,
    progress: generationStep === GENERATION_STEP.COMPLETED || generationStep === GENERATION_STEP.IMAGE_DONE ? 100 : 0,
    filePath: row.model_url,
    modelUrl: row.model_url,
    thumbnailUrl: row.thumbnail_url,
    modelName: row.name,
    previewImageUrls: toStringArray(row.preview_image_urls),
    originalImageUrls: toStringArray(row.original_image_urls),
    selectedImageUrl: row.selected_image_url,
    sourceFloorPlanId: row.source_floor_plan_id,
    planMetadata: row.plan_metadata as FloorPlanMetadata | null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type ThreeDModelRecord = ReturnType<typeof mapRow>;

export async function createImageDone(
  tdb: TenantDb,
  data: {
    projectId: string;
    prompt: string;
    imageTaskId: string;
    previewImageUrls: string[];
    originalImageUrls: string[];
    modelName: string;
  },
): Promise<ThreeDModelRecord> {
  const { rows } = await tdb.query<ThreeDModelRow>(
    `INSERT INTO ${tdb.ref('project_3d_models')}
       (project_id, name, status, meshy_task_id, preview_image_urls,
        original_image_urls, generation_step, prompt)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $3, $7)
     RETURNING *`,
    [
      data.projectId,
      data.modelName,
      GENERATION_STEP.IMAGE_DONE,
      data.imageTaskId,
      JSON.stringify(data.previewImageUrls),
      JSON.stringify(data.originalImageUrls),
      data.prompt,
    ],
  );

  return mapRow(rows[0]!);
}

export async function findById(tdb: TenantDb, id: string): Promise<ThreeDModelRecord | null> {
  const { rows } = await tdb.query<ThreeDModelRow>(
    `SELECT * FROM ${tdb.ref('project_3d_models')} WHERE id = $1 LIMIT 1`,
    [id],
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

export async function findByProjectId(tdb: TenantDb, projectId: string): Promise<ThreeDModelRecord[]> {
  const { rows } = await tdb.query<ThreeDModelRow>(
    `SELECT *
     FROM ${tdb.ref('project_3d_models')}
     WHERE project_id = $1
     ORDER BY created_at DESC`,
    [projectId],
  );

  return rows.map(mapRow);
}

export async function updateModelGeneration(
  tdb: TenantDb,
  id: string,
  data: { selectedImageUrl: string; meshyTaskId: string },
): Promise<ThreeDModelRecord | null> {
  const { rows } = await tdb.query<ThreeDModelRow>(
    `UPDATE ${tdb.ref('project_3d_models')}
     SET selected_image_url = $1,
         meshy_task_id = $2,
         generation_step = $3,
         status = $3,
         updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [data.selectedImageUrl, data.meshyTaskId, GENERATION_STEP.MODEL_GENERATING, id],
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

export async function updateGenerationStatus(
  tdb: TenantDb,
  id: string,
  data: {
    generationStep: GenerationStep;
    progress?: number;
    filePath?: string | null;
    thumbnailUrl?: string | null;
  },
): Promise<ThreeDModelRecord | null> {
  const setClauses = ['generation_step = $1', 'status = $1', 'updated_at = NOW()'];
  const params: unknown[] = [data.generationStep];

  if (data.filePath !== undefined) {
    params.push(data.filePath);
    setClauses.push(`model_url = $${params.length}`);
  }

  if (data.thumbnailUrl !== undefined) {
    params.push(data.thumbnailUrl);
    setClauses.push(`thumbnail_url = $${params.length}`);
  }

  params.push(id);
  const idParam = params.length;

  const { rows } = await tdb.query<ThreeDModelRow>(
    `UPDATE ${tdb.ref('project_3d_models')}
     SET ${setClauses.join(', ')}
     WHERE id = $${idParam}
     RETURNING *`,
    params,
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

export async function createFromFloorPlanImage(
  tdb: TenantDb,
  data: {
    projectId: string;
    imageUrl: string;
    floorPlanExportId?: string;
    planMetadata?: FloorPlanMetadata | null;
    prompt?: string;
  },
): Promise<ThreeDModelRecord> {
  const { rows } = await tdb.query<ThreeDModelRow>(
    `INSERT INTO ${tdb.ref('project_3d_models')}
       (project_id, name, status, meshy_task_id, preview_image_urls,
        original_image_urls, generation_step, prompt, selected_image_url,
        source_floor_plan_id, plan_metadata)
     VALUES ($1, $2, $3, NULL, $4::jsonb, $4::jsonb, $3, $5, $6, $7, $8::jsonb)
     RETURNING *`,
    [
      data.projectId,
      'Kat Planı 3D',
      GENERATION_STEP.IMAGE_DONE,
      JSON.stringify([data.imageUrl]),
      data.prompt ?? 'Kat planından 3D model',
      data.imageUrl,
      data.floorPlanExportId ?? null,
      data.planMetadata === undefined ? null : JSON.stringify(data.planMetadata),
    ],
  );

  return mapRow(rows[0]!);
}

export async function remove(tdb: TenantDb, id: string): Promise<ThreeDModelRecord | null> {
  const { rows } = await tdb.query<ThreeDModelRow>(
    `DELETE FROM ${tdb.ref('project_3d_models')} WHERE id = $1 RETURNING *`,
    [id],
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

export async function createFileInfo(
  tdb: TenantDb,
  data: {
    fileName: string;
    fileSize: number;
    filePath: string;
    uploadedBy: string;
    description?: string | null;
  },
): Promise<void> {
  await tdb.query(
    `INSERT INTO ${tdb.ref('file_info')}
       (original_name, stored_name, file_path, mime_type, file_size, uploaded_by)
     VALUES ($1, $1, $2, $3, $4, $5)`,
    [
      data.fileName,
      data.filePath,
      'model/gltf-binary',
      data.fileSize,
      data.uploadedBy,
    ],
  );
}
