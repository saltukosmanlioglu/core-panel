import axios, { AxiosRequestConfig } from 'axios';
import { z } from 'zod';
import { env } from '../../config/env';
import { AppError } from '../../lib/AppError';
import type { FloorPlanFeature, FloorPlanMetadata, FloorPlanRoom } from '@core-panel/shared';
import type {
  FloorplannerGenerateDrawingRequest,
  FloorplannerProvisionRequest,
} from '../../models/floorplanner.model';
import * as projectsRepo from '../projects/projects.repo';

type FloorplannerStep =
  | 'create sub-user'
  | 'get user token'
  | 'create project'
  | 'send drawing'
  | 'start export'
  | 'get export';

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

interface FloorplannerActor {
  userId?: string;
  email?: string;
  name?: string;
}

interface FloorplannerExportResponse {
  id?: string | number;
  status?: string;
  url?: string;
}

export interface FloorplannerExportResult {
  id: string;
  status: string;
  url?: string;
}

interface FloorplannerResponse {
  id?: string | number;
  user_id?: string | number;
  project_id?: string | number;
  token?: string;
  auth_token?: string;
  user?: FloorplannerResponse;
  project?: FloorplannerResponse;
}

interface StoredFloorPlanData {
  fmlData: FloorplannerFmlJson;
  planMetadata: FloorPlanMetadata;
}

const latestFloorPlanDataByProjectId = new Map<string, StoredFloorPlanData>();

const coordinateSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const fmlJsonSchema = z.object({
  walls: z.array(z.object({
    a: coordinateSchema,
    b: coordinateSchema,
    thickness: z.number().default(15),
    openings: z.array(z.unknown()).default([]),
  })),
  items: z.array(z.object({
    id: z.string(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    rotation: z.number(),
  }).passthrough()),
  areas: z.array(z.unknown()).default([]),
  labels: z.array(z.object({
    text: z.string(),
    x: z.number(),
    y: z.number(),
  }).passthrough()),
});

export type FloorplannerFmlJson = z.infer<typeof fmlJsonSchema>;

export interface FloorplannerProvisionResult {
  userId: string;
  authToken: string;
  projectId: string;
  environment: 'sandbox' | 'production';
  createdUser: boolean;
  createdProject: boolean;
}

export interface FloorplannerDrawingResult {
  floorplannerProjectId: string;
  fml: FloorplannerFmlJson;
  environment: 'sandbox' | 'production';
}

export function emptyFloorPlanMetadata(): FloorPlanMetadata {
  return {
    windows: [],
    doors: [],
    balconies: [],
    rooms: [],
    total_area: 0,
    floor_count: 0,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return null;
}

function itemKind(item: Record<string, unknown>): string {
  return [
    readString(item, ['type', 'itemType', 'item_type', 'kind', 'category']),
    readString(item, ['id', 'name', 'label']),
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();
}

function featureFromItem(item: Record<string, unknown>, type: string): FloorPlanFeature {
  return {
    ...item,
    id: readString(item, ['id', 'name']) ?? undefined,
    type,
    x: asNumber(item.x) ?? undefined,
    y: asNumber(item.y) ?? undefined,
    width: asNumber(item.width) ?? undefined,
    height: asNumber(item.height) ?? undefined,
    rotation: asNumber(item.rotation) ?? undefined,
  };
}

function roomFromArea(area: unknown, index: number): FloorPlanRoom | null {
  const record = asRecord(area);
  if (Object.keys(record).length === 0) return null;

  const name = readString(record, ['name', 'label', 'text', 'room', 'title']) ?? `Alan ${index + 1}`;
  return {
    ...record,
    name,
    area: asNumber(record.area ?? record.size ?? record.area_sqm ?? record.grossArea ?? record.gross_area) ?? undefined,
    floorNumber: asNumber(record.floorNumber ?? record.floor_number) ?? undefined,
    unitNumber: readString(record, ['unitNumber', 'unit_number', 'apartmentNumber', 'apartment_number']) ?? undefined,
  };
}

function roomFromLabel(label: unknown, index: number): FloorPlanRoom | null {
  const record = asRecord(label);
  const text = readString(record, ['text', 'name', 'label']);
  if (!text) return null;

  return {
    ...record,
    name: text,
    text,
    x: asNumber(record.x) ?? undefined,
    y: asNumber(record.y) ?? undefined,
    floorNumber: asNumber(record.floorNumber ?? record.floor_number) ?? undefined,
    unitNumber: readString(record, ['unitNumber', 'unit_number', 'apartmentNumber', 'apartment_number']) ?? index + 1,
  };
}

export function extractPlanMetadata(
  fml: FloorplannerFmlJson | null | undefined,
  input?: Partial<FloorplannerGenerateDrawingRequest>,
): FloorPlanMetadata {
  if (!fml) return emptyFloorPlanMetadata();

  const windows: FloorPlanFeature[] = [];
  const doors: FloorPlanFeature[] = [];
  const balconies: FloorPlanFeature[] = [];

  for (const rawItem of fml.items) {
    const item = asRecord(rawItem);
    const kind = itemKind(item);

    if (kind.includes('window')) {
      windows.push(featureFromItem(item, 'window'));
    }
    if (kind.includes('door')) {
      doors.push(featureFromItem(item, 'door'));
    }
    if (kind.includes('balcony') || kind.includes('terrace')) {
      balconies.push(featureFromItem(item, kind.includes('terrace') ? 'terrace' : 'balcony'));
    }
  }

  const areaRooms = fml.areas
    .map(roomFromArea)
    .filter((room): room is FloorPlanRoom => room !== null);
  const labelRooms = fml.labels
    .map(roomFromLabel)
    .filter((room): room is FloorPlanRoom => room !== null);
  const rooms = areaRooms.length > 0 ? areaRooms : labelRooms;
  const calculatedTotalArea = rooms.reduce((sum, room) => sum + (typeof room.area === 'number' ? room.area : 0), 0);

  return {
    windows,
    doors,
    balconies,
    rooms,
    total_area: input?.area ?? calculatedTotalArea,
    floor_count: input?.floorCount ?? 0,
  };
}

export function getStoredFloorPlanData(projectId: string): StoredFloorPlanData | null {
  return latestFloorPlanDataByProjectId.get(projectId) ?? null;
}

function floorplannerApiBaseUrl(): string {
  const baseUrl = env.FLOORPLANNER_BASE_URL.replace(/\/+$/, '');
  return baseUrl.endsWith('/api/v2') ? baseUrl : `${baseUrl}/api/v2`;
}

function floorplannerUrl(path: string): string {
  return `${floorplannerApiBaseUrl()}${path}`;
}

function floorplannerAuthHeader(): string {
  const encoded = Buffer.from(env.FLOORPLANNER_API_KEY).toString('base64');
  return `Basic ${encoded}`;
}

function getFloorplannerErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string; message?: string; errors?: unknown } | undefined;

    if (data?.message) {
      return data.message;
    }

    if (data?.error) {
      return data.error;
    }

    if (data?.errors) {
      return JSON.stringify(data.errors);
    }
  }

  return error instanceof Error ? error.message : fallback;
}

function logFloorplannerError(step: FloorplannerStep, error: unknown): void {
  if (axios.isAxiosError(error)) {
    console.error(`[Floorplanner] ${step} failed`, {
      responseStatus: error.response?.status,
      responseBody: error.response?.data,
    });
    return;
  }

  console.error(`[Floorplanner] ${step} failed`, { error });
}

function translateFloorplannerError(step: FloorplannerStep, error: unknown): AppError {
  const codeMap: Record<FloorplannerStep, string> = {
    'create sub-user': 'FLOORPLANNER_CREATE_USER_FAILED',
    'get user token': 'FLOORPLANNER_TOKEN_FAILED',
    'create project': 'FLOORPLANNER_CREATE_PROJECT_FAILED',
    'send drawing': 'FLOORPLANNER_SEND_DRAWING_FAILED',
    'start export': 'FLOORPLANNER_START_EXPORT_FAILED',
    'get export': 'FLOORPLANNER_GET_EXPORT_FAILED',
  };

  return new AppError(
    `Floorplanner ${step} failed: ${getFloorplannerErrorMessage(error, 'External request failed')}`,
    502,
    codeMap[step],
  );
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');

    if (first === -1 || last === -1 || last <= first) {
      throw new AppError('Claude did not return JSON', 502, 'CLAUDE_FML_JSON_MISSING');
    }

    return JSON.parse(trimmed.slice(first, last + 1));
  }
}

function validateAndNormalizeFml(value: unknown): FloorplannerFmlJson {
  const parsed = fmlJsonSchema.safeParse(value);

  if (!parsed.success) {
    throw new AppError(
      `Claude returned invalid FML JSON: ${parsed.error.issues[0]?.message ?? 'Validation failed'}`,
      502,
      'CLAUDE_FML_JSON_INVALID',
    );
  }

  return {
    ...parsed.data,
    walls: parsed.data.walls.map((wall) => ({
      ...wall,
      thickness: wall.thickness ?? 15,
      openings: wall.openings ?? [],
    })),
    areas: parsed.data.areas ?? [],
  };
}

function getClaudeText(message: { content: Array<{ type: string; text?: string }> }): string {
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('\n')
    .trim();
}

function buildFmlPrompt(params: FloorplannerGenerateDrawingRequest): string {
  const widthCm = Math.round(Math.sqrt(params.area) * 100);
  const depthCm = Math.round((params.area * 10000) / widthCm);

  return `Generate a valid Floorplanner FML JSON object for a residential floor plan.

Return ONLY JSON. Do not include markdown, comments, prose, or code fences.

Required JSON shape:
{
  "walls": [{ "a": { "x": 0, "y": 0 }, "b": { "x": 100, "y": 0 }, "thickness": 15, "openings": [] }],
  "items": [{ "id": "door", "x": 100, "y": 100, "width": 90, "height": 10, "rotation": 0 }],
  "areas": [],
  "labels": [{ "text": "Living Room", "x": 100, "y": 100 }]
}

User parameters:
- bedroom count: ${params.bedroomCount}
- bathroom count: ${params.bathroomCount ?? 1}
- total area: ${params.area} square meters
- kitchen type: ${params.kitchenType}
- property type: ${params.propertyType ?? 'apartment'}
- floor count: ${params.floorCount ?? 1}
- extras: ${params.extras.length > 0 ? params.extras.join(', ') : 'none'}

Rules:
- Units are centimeters.
- Make the outer footprint approximately ${widthCm}cm by ${depthCm}cm so total area is proportional to ${params.area}m2.
- Use orthogonal walls only.
- Include outer walls and major interior partition walls.
- Set every wall thickness to 15.
- Keep coordinates positive.
- Include labels for every bedroom, bathroom, kitchen, living area, and selected extras.
- Include simple item rectangles for doors, kitchen counter, beds, bathroom fixtures, wardrobes, tables, or terrace/balcony furniture where relevant.
- Keep the result compact enough to fit the requested area.
- areas must be an array, even if empty.`;
}

async function generateFmlWithClaude(params: FloorplannerGenerateDrawingRequest): Promise<FloorplannerFmlJson> {
  try {
    const Anthropic = require('@anthropic-ai/sdk').default as typeof import('@anthropic-ai/sdk').default;
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: buildFmlPrompt(params),
        },
      ],
    });

    return validateAndNormalizeFml(extractJsonObject(getClaudeText(message)));
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error('[Claude] FML generation failed', { error });
    throw new AppError(
      `Claude FML generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      502,
      'CLAUDE_FML_GENERATION_FAILED',
    );
  }
}

async function sendDrawingToFloorplanner(
  floorplannerProjectId: string,
  fml: FloorplannerFmlJson,
): Promise<void> {
  await requestFloorplanner<unknown>({
    method: 'PUT',
    url: floorplannerUrl(`/projects/${encodeURIComponent(floorplannerProjectId)}/floors/1/designs/1/drawing`),
    data: { fml },
  }, 'send drawing');
}

async function requestFloorplanner<T>(
  config: AxiosRequestConfig,
  step: FloorplannerStep,
): Promise<T> {
  try {
    const response = await axios.request<T>({
      timeout: 20000,
      ...config,
      headers: {
        Authorization: floorplannerAuthHeader(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...config.headers,
      },
    });

    return response.data;
  } catch (error) {
    logFloorplannerError(step, error);
    throw translateFloorplannerError(step, error);
  }
}

function readId(
  response: FloorplannerResponse,
  keys: Array<'id' | 'user_id' | 'project_id'>,
  fallbackCode: string,
  fallbackMessage: string,
): string {
  for (const key of keys) {
    const value = response[key] ?? response.user?.[key] ?? response.project?.[key];
    if (value !== undefined && value !== null && String(value).length > 0) {
      return String(value);
    }
  }

  throw new AppError(fallbackMessage, 502, fallbackCode);
}

function readToken(response: FloorplannerResponse): string {
  const token = response.auth_token ?? response.token ?? response.user?.auth_token ?? response.user?.token;

  if (!token) {
    throw new AppError('Floorplanner auth token was not returned', 502, 'FLOORPLANNER_TOKEN_MISSING');
  }

  return token;
}

function buildFallbackEmail(projectId: string): string {
  return `floorplanner-${projectId}@core-panel.local`;
}

function buildSubUserPayload(
  project: projectsRepo.ProjectRecord,
  input: FloorplannerProvisionRequest,
  actor: FloorplannerActor,
) {
  return {
    user: {
      email: input?.user?.email ?? actor.email ?? buildFallbackEmail(project.id),
      name: input?.user?.name ?? actor.name ?? project.name,
      external_identifier: input?.user?.externalIdentifier ?? actor.userId ?? project.id,
    },
  };
}

function buildProjectPayload(
  project: projectsRepo.ProjectRecord,
  floorplannerUserId: string,
  input: FloorplannerProvisionRequest,
) {
  return {
    project: {
      name: input?.project?.name ?? project.name,
      description: input?.project?.description ?? project.description ?? undefined,
      external_identifier: input?.project?.externalIdentifier ?? project.id,
      user_id: floorplannerUserId,
    },
  };
}

async function createSubUser(
  project: projectsRepo.ProjectRecord,
  input: FloorplannerProvisionRequest,
  actor: FloorplannerActor,
): Promise<string> {
  const response = await requestFloorplanner<FloorplannerResponse>({
    method: 'POST',
    url: floorplannerUrl('/users'),
    data: buildSubUserPayload(project, input, actor),
  }, 'create sub-user');

  return readId(
    response,
    ['user_id', 'id'],
    'FLOORPLANNER_USER_ID_MISSING',
    'Floorplanner sub-user id was not returned',
  );
}

async function getUserToken(floorplannerUserId: string): Promise<string> {
  const response = await requestFloorplanner<FloorplannerResponse>({
    method: 'GET',
    url: floorplannerUrl(`/users/${encodeURIComponent(floorplannerUserId)}/token`),
  }, 'get user token');

  return readToken(response);
}

async function createFloorplannerProject(
  project: projectsRepo.ProjectRecord,
  floorplannerUserId: string,
  input: FloorplannerProvisionRequest,
): Promise<string> {
  const response = await requestFloorplanner<FloorplannerResponse>({
    method: 'POST',
    url: floorplannerUrl('/projects'),
    data: buildProjectPayload(project, floorplannerUserId, input),
  }, 'create project');

  return readId(
    response,
    ['project_id', 'id'],
    'FLOORPLANNER_PROJECT_ID_MISSING',
    'Floorplanner project id was not returned',
  );
}

export async function provisionProject(
  companyId: string,
  projectId: string,
  input: FloorplannerProvisionRequest,
  actor: FloorplannerActor,
): Promise<FloorplannerProvisionResult> {
  const project = await projectsRepo.findById(companyId, projectId);

  if (!project) {
    throw new AppError('İnşaat bulunamadı', 404, 'NOT_FOUND');
  }

  let floorplannerUserId = project.floorplannerUserId;
  let createdUser = false;

  if (!floorplannerUserId) {
    floorplannerUserId = await createSubUser(project, input, actor);
    await projectsRepo.updateFloorplannerUserId(companyId, projectId, floorplannerUserId);
    createdUser = true;
  }

  const authToken = await getUserToken(floorplannerUserId);
  let floorplannerProjectId = project.floorplannerProjectId;
  let createdProject = false;

  if (!floorplannerProjectId) {
    floorplannerProjectId = await createFloorplannerProject(project, floorplannerUserId, input);
    await projectsRepo.updateFloorplannerProjectId(companyId, projectId, floorplannerProjectId);
    createdProject = true;
  }

  return {
    userId: floorplannerUserId,
    authToken,
    projectId: floorplannerProjectId,
    environment: env.FLOORPLANNER_ENV,
    createdUser,
    createdProject,
  };
}

export async function startExport(
  companyId: string,
  projectId: string,
): Promise<FloorplannerExportResult> {
  const project = await projectsRepo.findById(companyId, projectId);

  if (!project) {
    throw new AppError('İnşaat bulunamadı', 404, 'NOT_FOUND');
  }

  if (!project.floorplannerProjectId) {
    throw new AppError('Floorplanner projesi henüz oluşturulmamış', 400, 'FLOORPLANNER_PROJECT_NOT_FOUND');
  }

  const response = await requestFloorplanner<FloorplannerExportResponse>({
    method: 'POST',
    url: floorplannerUrl(`/projects/${encodeURIComponent(project.floorplannerProjectId)}/exports`),
    data: { export: { type: '2d' } },
  }, 'start export');

  const id = response.id != null ? String(response.id) : null;

  if (!id) {
    throw new AppError('Floorplanner export id was not returned', 502, 'FLOORPLANNER_EXPORT_ID_MISSING');
  }

  return { id, status: response.status ?? 'pending' };
}

export async function getExport(exportId: string): Promise<FloorplannerExportResult> {
  const response = await requestFloorplanner<FloorplannerExportResponse>({
    method: 'GET',
    url: floorplannerUrl(`/exports/${encodeURIComponent(exportId)}`),
  }, 'get export');

  return {
    id: response.id != null ? String(response.id) : exportId,
    status: response.status ?? 'pending',
    url: response.url,
  };
}

export async function generateAndSendDrawing(
  companyId: string,
  projectId: string,
  input: FloorplannerGenerateDrawingRequest,
  actor: FloorplannerActor,
): Promise<FloorplannerDrawingResult> {
  const provisioned = await provisionProject(
    companyId,
    projectId,
    {
      project: {
        name: `${input.propertyType ?? 'apartment'} ${input.area}m2`,
        description: `${input.bedroomCount} bedrooms, ${input.bathroomCount ?? 1} bathrooms, ${input.kitchenType} kitchen`,
        externalIdentifier: projectId,
      },
    },
    actor,
  );
  const fml = await generateFmlWithClaude(input);
  await sendDrawingToFloorplanner(provisioned.projectId, fml);
  latestFloorPlanDataByProjectId.set(projectId, {
    fmlData: fml,
    planMetadata: extractPlanMetadata(fml, input),
  });

  return {
    floorplannerProjectId: provisioned.projectId,
    fml,
    environment: env.FLOORPLANNER_ENV,
  };
}
