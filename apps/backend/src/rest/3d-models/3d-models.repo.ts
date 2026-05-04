import { TenantDb } from '../../lib/tenantDb';

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
  prompt: string;
  texture_prompt: string | null;
  enhanced_prompt: string | null;
  meshy_task_id: string | null;
  meshy_texture_task_id: string | null;
  image_task_id: string | null;
  status: string;
  generation_step: string | null;
  progress: number | null;
  file_path: string | null;
  thumbnail_url: string | null;
  model_name: string | null;
  preview_image_urls: unknown;
  original_image_urls: unknown;
  selected_image_url: string | null;
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
    prompt: row.prompt,
    texturePrompt: row.texture_prompt,
    enhancedPrompt: row.enhanced_prompt,
    meshyTaskId: row.meshy_task_id,
    meshyTextureTaskId: row.meshy_texture_task_id,
    imageTaskId: row.image_task_id,
    status: generationStep,
    generationStep,
    progress: row.progress ?? 0,
    filePath: row.file_path,
    modelUrl: row.file_path,
    thumbnailUrl: row.thumbnail_url,
    modelName: row.model_name,
    previewImageUrls: toStringArray(row.preview_image_urls),
    originalImageUrls: toStringArray(row.original_image_urls),
    selectedImageUrl: row.selected_image_url,
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
    enhancedPrompt: string;
    imageTaskId: string;
    previewImageUrls: string[];
    originalImageUrls: string[];
    modelName: string;
  },
): Promise<ThreeDModelRecord> {
  const { rows } = await tdb.query<ThreeDModelRow>(
    `INSERT INTO ${tdb.ref('project_3d_models')}
       (project_id, prompt, enhanced_prompt, image_task_id, preview_image_urls,
        original_image_urls, generation_step, status, progress, model_name)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $7, $8, $9)
     RETURNING *`,
    [
      data.projectId,
      data.prompt,
      data.enhancedPrompt,
      data.imageTaskId,
      JSON.stringify(data.previewImageUrls),
      JSON.stringify(data.originalImageUrls),
      GENERATION_STEP.IMAGE_DONE,
      100,
      data.modelName,
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
         progress = 0,
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

  if (data.progress !== undefined) {
    params.push(data.progress);
    setClauses.push(`progress = $${params.length}`);
  }

  if (data.filePath !== undefined) {
    params.push(data.filePath);
    setClauses.push(`file_path = $${params.length}`);
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
  },
): Promise<ThreeDModelRecord> {
  const { rows } = await tdb.query<ThreeDModelRow>(
    `INSERT INTO ${tdb.ref('project_3d_models')}
       (project_id, prompt, enhanced_prompt, image_task_id, preview_image_urls,
        original_image_urls, generation_step, status, progress, model_name, selected_image_url)
     VALUES ($1, $2, $3, $4, $5::jsonb, $5::jsonb, $6, $6, $7, $8, $9)
     RETURNING *`,
    [
      data.projectId,
      'Kat planından 3D model',
      'Kat planından 3D model',
      data.floorPlanExportId ?? 'floor-plan',
      JSON.stringify([data.imageUrl]),
      GENERATION_STEP.IMAGE_DONE,
      100,
      'Kat Planı 3D',
      data.imageUrl,
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
       (file_name, file_type, file_size, file_path, mime_type, uploaded_by, description, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      data.fileName,
      '3d-model',
      data.fileSize,
      data.filePath,
      'model/gltf-binary',
      data.uploadedBy,
      data.description ?? null,
      ['3d-model', 'meshy'],
    ],
  );
}
