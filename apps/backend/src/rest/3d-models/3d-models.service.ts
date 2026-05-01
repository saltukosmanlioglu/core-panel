import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env';
import { UPLOADS_DIR } from '../../config/paths';
import { AppError } from '../../lib/AppError';
import { TenantDb } from '../../lib/tenantDb';
import * as repo from './3d-models.repo';

const MESHY_TEXT_TO_IMAGE_URL = 'https://api.meshy.ai/openapi/v1/text-to-image';
const MESHY_IMAGE_TO_3D_URL = 'https://api.meshy.ai/openapi/v1/image-to-3d';
const CLAUDE_MODEL = 'claude-sonnet-4-6';
const MODEL_UPLOADS_DIR_NAME = '3d-models';
const IMAGES_UPLOADS_DIR_NAME = '3d-images';
const IMAGE_POLL_INTERVAL_MS = 2000;
const IMAGE_POLL_MAX_ATTEMPTS = 120;
const BASE_URL = process.env.API_BASE_URL ?? `http://localhost:${env.PORT}`;

const ANGLE_SUFFIXES = [
  ', front elevation view',
  ', side elevation view',
  ', aerial bird\'s eye view',
  ', isometric perspective view',
  ', three-quarter perspective view',
];

interface MeshyCreateResponse {
  result: string;
}

type MeshyRemoteStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED';

interface MeshyImageStatusResponse {
  id?: string;
  status?: MeshyRemoteStatus | string;
  progress?: number;
  image_urls?: string[];
}

interface MeshyModelStatusResponse {
  id?: string;
  status?: MeshyRemoteStatus | string;
  progress?: number;
  model_urls?: {
    glb?: string;
    fbx?: string;
  };
  thumbnail_url?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getTaskId(data: MeshyCreateResponse): string {
  const taskId = data.result;

  if (!taskId) {
    throw new AppError('Meshy görev numarası alınamadı', 502, 'MESHY_TASK_ID_MISSING');
  }

  return taskId;
}

function normalizeProgress(progress: unknown): number {
  const numeric = Number(progress);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  const asPercent = numeric > 0 && numeric <= 1 ? numeric * 100 : numeric;
  return Math.max(0, Math.min(100, Math.round(asPercent)));
}

function normalizeRemoteStatus(status: string | undefined): MeshyRemoteStatus | null {
  const normalized = status?.toUpperCase();

  if (
    normalized === 'PENDING' ||
    normalized === 'IN_PROGRESS' ||
    normalized === 'SUCCEEDED' ||
    normalized === 'FAILED'
  ) {
    return normalized;
  }

  return null;
}

function getMeshyErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; error?: string } | undefined;
    return data?.message ?? data?.error ?? fallback;
  }

  return error instanceof Error ? error.message : fallback;
}

function translateMeshyError(error: unknown, fallback: string): AppError {
  return new AppError(
    `Meshy işlemi tamamlanamadı: ${getMeshyErrorMessage(error, fallback)}`,
    502,
    'MESHY_API_ERROR',
  );
}

function logMeshyError(context: string, error: unknown): void {
  if (axios.isAxiosError(error)) {
    console.error(`[Meshy] ${context}`, {
      error,
      responseStatus: error.response?.status,
      responseBody: error.response?.data,
    });
    return;
  }

  console.error(`[Meshy] ${context}`, { error });
}

function buildModelName(prompt: string): string {
  const trimmed = prompt.replace(/\s+/g, ' ').trim();
  const base = trimmed.length > 45 ? `${trimmed.slice(0, 45).trim()}...` : trimmed;
  return base || '3D Model';
}

async function callMeshyCreate<TBody extends Record<string, unknown>>(
  url: string,
  body: TBody,
  context: string,
): Promise<string> {
  try {
    const response = await axios.post<MeshyCreateResponse>(url, body, {
      headers: {
        Authorization: `Bearer ${env.MESHY_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('[MESHY RESPONSE]', JSON.stringify(response.data, null, 2));
    console.log(`[Meshy] ${context} raw response:`, response.data);
    return getTaskId(response.data);
  } catch (error) {
    logMeshyError(`${context} failed`, error);
    throw translateMeshyError(error, 'Meshy görevi başlatılamadı');
  }
}

async function pollMeshyImage(taskId: string): Promise<MeshyImageStatusResponse> {
  try {
    const response = await axios.get<MeshyImageStatusResponse>(`${MESHY_TEXT_TO_IMAGE_URL}/${taskId}`, {
      headers: {
        Authorization: `Bearer ${env.MESHY_API_KEY}`,
      },
    });

    console.log('[Meshy] text-to-image status raw response:', response.data);
    return response.data;
  } catch (error) {
    logMeshyError('text-to-image status polling failed', error);
    throw translateMeshyError(error, 'Görsel üretim durumu alınamadı');
  }
}

async function pollMeshyModel(taskId: string): Promise<MeshyModelStatusResponse> {
  try {
    const response = await axios.get<MeshyModelStatusResponse>(`${MESHY_IMAGE_TO_3D_URL}/${taskId}`, {
      headers: {
        Authorization: `Bearer ${env.MESHY_API_KEY}`,
      },
    });

    console.log('[Meshy] image-to-3d status raw response:', response.data);
    return response.data;
  } catch (error) {
    logMeshyError('image-to-3d status polling failed', error);
    throw translateMeshyError(error, '3D model durumu alınamadı');
  }
}

async function enhancePrompt(prompt: string): Promise<string> {
  try {
    const Anthropic = require('@anthropic-ai/sdk').default as typeof import('@anthropic-ai/sdk').default;
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 300,
      system: `You are an architectural visualization expert.
Convert the user's building description into a detailed English architectural image generation prompt.
Max 600 characters. Return only the prompt text.`,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    return (responseText || prompt).slice(0, 600);
  } catch {
    return prompt.slice(0, 600);
  }
}

async function waitForImageGeneration(taskId: string): Promise<string> {
  for (let attempt = 0; attempt < IMAGE_POLL_MAX_ATTEMPTS; attempt += 1) {
    const result = await pollMeshyImage(taskId);
    const remoteStatus = normalizeRemoteStatus(result.status);

    if (remoteStatus === 'SUCCEEDED') {
      const imageUrls = Array.isArray(result.image_urls)
        ? result.image_urls.filter((url): url is string => typeof url === 'string' && url.length > 0)
        : [];

      if (imageUrls.length === 0) {
        throw new AppError('Meshy görsel URL bilgisi döndürmedi', 502, 'MESHY_IMAGE_URLS_MISSING');
      }

      return imageUrls[0]!;
    }

    if (remoteStatus === 'FAILED') {
      throw new AppError('Meshy görsel üretimi başarısız oldu', 502, 'MESHY_IMAGE_GENERATION_FAILED');
    }

    await sleep(IMAGE_POLL_INTERVAL_MS);
  }

  throw new AppError('Görsel üretimi zaman aşımına uğradı', 504, 'MESHY_IMAGE_TIMEOUT');
}

async function saveGlbFromUrl(
  tdb: TenantDb,
  model: repo.ThreeDModelRecord,
  glbUrl: string,
  userId: string,
): Promise<string> {
  const response = await axios.get<ArrayBuffer>(glbUrl, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(response.data);
  const fileName = `${uuidv4()}.glb`;
  const modelUploadsDir = path.join(UPLOADS_DIR, MODEL_UPLOADS_DIR_NAME);
  const absolutePath = path.join(modelUploadsDir, fileName);
  const publicPath = `/uploads/${MODEL_UPLOADS_DIR_NAME}/${fileName}`;

  await fs.promises.mkdir(modelUploadsDir, { recursive: true });
  await fs.promises.writeFile(absolutePath, buffer);

  await repo.createFileInfo(tdb, {
    fileName,
    fileSize: buffer.length,
    filePath: publicPath,
    uploadedBy: userId,
    description: model.modelName ?? 'Meshy 3D model',
  });

  return publicPath;
}

async function downloadToLocal(remoteUrl: string, subdir: string, filename: string): Promise<string> {
  const response = await axios.get<ArrayBuffer>(remoteUrl, { responseType: 'arraybuffer' });
  const targetDir = path.join(UPLOADS_DIR, subdir);
  const filePath = path.join(targetDir, filename);
  await fs.promises.mkdir(targetDir, { recursive: true });
  await fs.promises.writeFile(filePath, Buffer.from(response.data));
  return `${BASE_URL}/uploads/${subdir}/${filename}`;
}

async function downloadPreviewImages(imageUrls: string[]): Promise<string[]> {
  return Promise.all(
    imageUrls.map(async (url, index) => {
      try {
        const filename = `3d-image-${Date.now()}-${index}-${uuidv4()}.png`;
        return await downloadToLocal(url, IMAGES_UPLOADS_DIR_NAME, filename);
      } catch {
        return url;
      }
    }),
  );
}

async function downloadThumbnail(thumbnailUrl: string): Promise<string> {
  try {
    const filename = `3d-thumb-${Date.now()}-${uuidv4()}.png`;
    return await downloadToLocal(thumbnailUrl, IMAGES_UPLOADS_DIR_NAME, filename);
  } catch {
    return thumbnailUrl;
  }
}

export async function generateImages(
  tdb: TenantDb,
  projectId: string,
  data: { prompt: string },
): Promise<repo.ThreeDModelRecord> {
  const enhancedPrompt = await enhancePrompt(data.prompt);

  const taskIds = await Promise.all(
    ANGLE_SUFFIXES.map((suffix) => {
      const body = {
        ai_model: 'nano-banana-pro',
        prompt: `${enhancedPrompt}${suffix}`,
        aspect_ratio: '1:1',
      };
      console.log('[MESHY REQUEST]', JSON.stringify({ url: MESHY_TEXT_TO_IMAGE_URL, body }, null, 2));
      return callMeshyCreate(MESHY_TEXT_TO_IMAGE_URL, body, 'text-to-image create');
    }),
  );

  const originalUrls = await Promise.all(taskIds.map(waitForImageGeneration));
  console.log('[IMAGE URLS]', originalUrls);

  const localUrls = await downloadPreviewImages(originalUrls);

  return repo.createImageDone(tdb, {
    projectId,
    prompt: data.prompt,
    enhancedPrompt,
    imageTaskId: taskIds[0]!,
    previewImageUrls: localUrls,
    originalImageUrls: originalUrls,
    modelName: buildModelName(data.prompt),
  });
}

export async function generateModelFromImage(
  tdb: TenantDb,
  id: string,
  selectedImageUrl: string,
): Promise<repo.ThreeDModelRecord> {
  const model = await repo.findById(tdb, id);

  if (!model) {
    throw new AppError('3D model kaydı bulunamadı', 404, 'NOT_FOUND');
  }

  const localIndex = model.previewImageUrls.indexOf(selectedImageUrl);

  if (model.previewImageUrls.length > 0 && localIndex === -1) {
    throw new AppError('Seçilen görsel bu modele ait değil', 400, 'INVALID_SELECTED_IMAGE');
  }

  const meshyImageUrl = model.originalImageUrls[localIndex] ?? selectedImageUrl;

  const meshyTaskId = await callMeshyCreate(
    MESHY_IMAGE_TO_3D_URL,
    {
      image_url: meshyImageUrl,
      enable_pbr: true,
      target_formats: ['glb'],
    },
    'image-to-3d create',
  );

  const updated = await repo.updateModelGeneration(tdb, id, {
    selectedImageUrl,
    meshyTaskId,
  });

  if (!updated) {
    throw new AppError('3D model güncellenemedi', 500, 'MODEL_UPDATE_FAILED');
  }

  return updated;
}

export async function syncStatus(
  tdb: TenantDb,
  id: string,
  userId: string,
): Promise<repo.ThreeDModelRecord> {
  const model = await repo.findById(tdb, id);

  if (!model) {
    throw new AppError('3D model bulunamadı', 404, 'NOT_FOUND');
  }

  if (model.generationStep !== repo.GENERATION_STEP.MODEL_GENERATING) {
    return model;
  }

  if (!model.meshyTaskId) {
    throw new AppError('Model için Meshy görev numarası bulunamadı', 400, 'MESHY_TASK_ID_MISSING');
  }

  const meshyStatus = await pollMeshyModel(model.meshyTaskId);
  const remoteStatus = normalizeRemoteStatus(meshyStatus.status);
  const progress = normalizeProgress(meshyStatus.progress);
  const thumbnailUrl = meshyStatus.thumbnail_url ?? model.thumbnailUrl;

  if (remoteStatus === 'SUCCEEDED') {
    const glbUrl = meshyStatus.model_urls?.glb;
    let modelUrl = model.filePath;

    if (glbUrl) {
      const previousLocalPath = model.filePath?.startsWith('/uploads/') ? model.filePath : null;

      try {
        modelUrl = await saveGlbFromUrl(tdb, model, glbUrl, userId);
      } catch {
        modelUrl = glbUrl;
      }

      if (previousLocalPath && previousLocalPath !== modelUrl) {
        try {
          await deleteLocalFile(previousLocalPath);
        } catch {
          // Replacing the model should not fail because an older local preview could not be removed.
        }
      }
    }

    const localThumbnailUrl = thumbnailUrl ? await downloadThumbnail(thumbnailUrl) : null;

    const updated = await repo.updateGenerationStatus(tdb, id, {
      generationStep: repo.GENERATION_STEP.COMPLETED,
      progress: 100,
      filePath: modelUrl ?? null,
      thumbnailUrl: localThumbnailUrl,
    });

    if (!updated) {
      throw new AppError('3D model güncellenemedi', 500, 'MODEL_UPDATE_FAILED');
    }

    return updated;
  }

  if (remoteStatus === 'FAILED') {
    const updated = await repo.updateGenerationStatus(tdb, id, {
      generationStep: repo.GENERATION_STEP.FAILED,
      progress,
      thumbnailUrl,
    });

    if (!updated) {
      throw new AppError('3D model güncellenemedi', 500, 'MODEL_UPDATE_FAILED');
    }

    return updated;
  }

  const updated = await repo.updateGenerationStatus(tdb, id, {
    generationStep: repo.GENERATION_STEP.MODEL_GENERATING,
    progress,
    thumbnailUrl,
  });

  if (!updated) {
    throw new AppError('3D model güncellenemedi', 500, 'MODEL_UPDATE_FAILED');
  }

  return updated;
}

export async function deleteLocalFile(filePath: string | null): Promise<void> {
  if (!filePath) {
    return;
  }

  try {
    const pathname = filePath.startsWith('http://') || filePath.startsWith('https://')
      ? new URL(filePath).pathname
      : filePath;

    if (!pathname.startsWith('/uploads/')) {
      return;
    }

    const relativePath = decodeURIComponent(pathname.replace(/^\/uploads\/?/, ''));
    const absolutePath = path.resolve(UPLOADS_DIR, relativePath);
    const uploadsRoot = path.resolve(UPLOADS_DIR);

    if (absolutePath !== uploadsRoot && !absolutePath.startsWith(`${uploadsRoot}${path.sep}`)) {
      return;
    }

    await fs.promises.unlink(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}
