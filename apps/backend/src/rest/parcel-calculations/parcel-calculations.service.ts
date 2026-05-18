import fs from 'fs';
import path from 'path';
import { env } from '../../config/env';
import { AppError } from '../../lib/AppError';

export interface Edge {
  label: string;
  length: number;
  angle: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Setbacks {
  front: number;
  back: number;
  left: number;
  right: number;
}

export interface Overhang {
  floor: number;
  front: number;
  back: number;
  left: number;
  right: number;
}

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const CM_PER_METER = 100;
const SQ_CM_PER_SQ_M = 10000;

const SETBACK_SYSTEM_PROMPT = `You are an expert at reading Turkish construction permit documents.
Extract garden setback (bahçe çekme) distances in meters.
Return JSON only:
{ front: number, back: number, left: number, right: number }
Field names in Turkish documents:
- Ön bahçe çekmesi = front
- Arka bahçe çekmesi = back
- Yan bahçe çekmesi = left AND right (unless specified separately)
- Sol yan bahçe = left
- Sağ yan bahçe = right
Return 0 for any value not found.`;

type ClaudeImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

type ClaudeFileBlock =
  | {
    type: 'document';
    source: {
      type: 'base64';
      media_type: 'application/pdf';
      data: string;
    };
  }
  | {
    type: 'image';
    source: {
      type: 'base64';
      media_type: ClaudeImageMediaType;
      data: string;
    };
  };

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function round(value: number, precision = 4): number {
  const multiplier = 10 ** precision;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function roundArea(value: number): number {
  return round(value, 2);
}

function distance(first: Point, second: Point): number {
  return Math.sqrt((second.x - first.x) ** 2 + (second.y - first.y) ** 2);
}

function signedArea(vertices: Point[]): number {
  let area = 0;

  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i]!.x * vertices[j]!.y;
    area -= vertices[j]!.x * vertices[i]!.y;
  }

  return area / 2;
}

function boundingBox(vertices: Point[]): { minX: number; maxX: number; minY: number; maxY: number } {
  return {
    minX: Math.min(...vertices.map((point) => point.x)),
    maxX: Math.max(...vertices.map((point) => point.x)),
    minY: Math.min(...vertices.map((point) => point.y)),
    maxY: Math.max(...vertices.map((point) => point.y)),
  };
}

export function calculateVertices(edges: Edge[]): Point[] {
  let currentX = 0;
  let currentY = 0;
  let direction = 90;
  const vertices: Point[] = [{ x: 0, y: 0 }];

  for (const edge of edges) {
    const lengthCm = edge.length * CM_PER_METER;
    const directionRad = degreesToRadians(direction);

    currentX += lengthCm * Math.cos(directionRad);
    currentY += lengthCm * Math.sin(directionRad);
    vertices.push({ x: round(currentX), y: round(currentY) });

    direction -= (180 - edge.angle);
  }

  if (vertices.length > 2 && distance(vertices[0]!, vertices[vertices.length - 1]!) < 0.01) {
    vertices.pop();
  }

  return vertices;
}

export function calculatePolygonArea(vertices: Point[]): number {
  if (vertices.length < 3) return 0;

  let area = 0;
  const n = vertices.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i]!.x * vertices[j]!.y;
    area -= vertices[j]!.x * vertices[i]!.y;
  }

  return roundArea(Math.abs(area) / 2 / SQ_CM_PER_SQ_M);
}

function normalizeVector(vector: Point): Point {
  const length = Math.sqrt(vector.x ** 2 + vector.y ** 2);
  if (length === 0) return { x: 0, y: 0 };
  return { x: vector.x / length, y: vector.y / length };
}

function normalizedEdgeVector(start: Point, end: Point): Point {
  return normalizeVector({ x: end.x - start.x, y: end.y - start.y });
}

function normalizedInwardNormal(start: Point, end: Point, clockwise: boolean): Point {
  const edge = normalizedEdgeVector(start, end);
  return clockwise
    ? { x: edge.y, y: -edge.x }
    : { x: -edge.y, y: edge.x };
}

function getSetbackForEdgeIndex(
  edgeIndex: number,
  frontEdgeIndex: number,
  edgeCount: number,
  setbacks: Setbacks,
): number {
  const relativeIndex = ((edgeIndex - frontEdgeIndex) % edgeCount + edgeCount) % edgeCount;

  if (relativeIndex === 0) return setbacks.front * CM_PER_METER;
  if (relativeIndex === 1) return setbacks.right * CM_PER_METER;
  if (relativeIndex === 2) return setbacks.back * CM_PER_METER;
  if (relativeIndex === 3) return setbacks.left * CM_PER_METER;

  return ((setbacks.left + setbacks.right) / 2) * CM_PER_METER;
}

function lineIntersection(a: Point, directionA: Point, b: Point, directionB: Point): Point | null {
  const cross = directionA.x * directionB.y - directionA.y * directionB.x;
  if (Math.abs(cross) < 0.000001) return null;

  const delta = { x: b.x - a.x, y: b.y - a.y };
  const t = (delta.x * directionB.y - delta.y * directionB.x) / cross;

  return {
    x: a.x + directionA.x * t,
    y: a.y + directionA.y * t,
  };
}

function pointInPolygon(p: Point, poly: Point[]): boolean {
  if (poly.length < 3) return false;

  for (let i = 0; i < poly.length; i++) {
    if (distance(p, nearestPointOnSegment(p, poly[i]!, poly[(i + 1) % poly.length]!)) < 0.0001) {
      return true;
    }
  }

  let inside = false;

  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const current = poly[i]!;
    const previous = poly[j]!;
    const intersects = ((current.y > p.y) !== (previous.y > p.y))
      && p.x < ((previous.x - current.x) * (p.y - current.y)) / (previous.y - current.y) + current.x;

    if (intersects) inside = !inside;
  }

  return inside;
}

function nearestPointOnSegment(p: Point, a: Point, b: Point): Point {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const lengthSquared = ab.x ** 2 + ab.y ** 2;
  if (lengthSquared === 0) return a;

  const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / lengthSquared));

  return {
    x: a.x + ab.x * t,
    y: a.y + ab.y * t,
  };
}

function nearestPointOnPolygonBoundary(p: Point, poly: Point[]): Point {
  if (poly.length === 0) return p;

  let nearest = poly[0]!;
  let nearestDistance = Infinity;

  for (let i = 0; i < poly.length; i++) {
    const candidate = nearestPointOnSegment(p, poly[i]!, poly[(i + 1) % poly.length]!);
    const candidateDistance = distance(p, candidate);

    if (candidateDistance < nearestDistance) {
      nearest = candidate;
      nearestDistance = candidateDistance;
    }
  }

  return nearest;
}

export function calculateFootprint(vertices: Point[], setbacks: Setbacks, frontEdgeIndex = 0): Point[] {
  if (vertices.length < 3) return [];

  const clockwise = signedArea(vertices) < 0;
  const inset = vertices.map((curr, index) => {
    const prev = vertices[(index - 1 + vertices.length) % vertices.length]!;
    const next = vertices[(index + 1) % vertices.length]!;
    const prevNormal = normalizedInwardNormal(prev, curr, clockwise);
    const nextNormal = normalizedInwardNormal(curr, next, clockwise);
    const prevEdgeIndex = (index - 1 + vertices.length) % vertices.length;
    const nextEdgeIndex = index;
    const prevSetback = getSetbackForEdgeIndex(prevEdgeIndex, frontEdgeIndex, vertices.length, setbacks);
    const nextSetback = getSetbackForEdgeIndex(nextEdgeIndex, frontEdgeIndex, vertices.length, setbacks);
    const prevDirection = normalizedEdgeVector(prev, curr);
    const nextDirection = normalizedEdgeVector(curr, next);
    const prevOffset = {
      x: prevNormal.x * prevSetback,
      y: prevNormal.y * prevSetback,
    };
    const nextOffset = {
      x: nextNormal.x * nextSetback,
      y: nextNormal.y * nextSetback,
    };
    const miterPoint = lineIntersection(
      { x: prev.x + prevOffset.x, y: prev.y + prevOffset.y },
      prevDirection,
      { x: curr.x + nextOffset.x, y: curr.y + nextOffset.y },
      nextDirection,
    ) ?? {
      x: curr.x + prevOffset.x + nextOffset.x,
      y: curr.y + prevOffset.y + nextOffset.y,
    };

    const point = {
      x: round(miterPoint.x),
      y: round(miterPoint.y),
    };

    return pointInPolygon(point, vertices)
      ? point
      : nearestPointOnPolygonBoundary(point, vertices);
  });

  return inset.map((point) => ({ x: round(point.x), y: round(point.y) }));
}

export function calculateOverhangArea(footprintVertices: Point[], overhang: Overhang): number {
  if (footprintVertices.length === 0) return 0;

  const box = boundingBox(footprintVertices);
  const minX = box.minX - overhang.left * CM_PER_METER;
  const maxX = box.maxX + overhang.right * CM_PER_METER;
  const minY = box.minY - overhang.back * CM_PER_METER;
  const maxY = box.maxY + overhang.front * CM_PER_METER;
  const areaSqCm = Math.max(0, maxX - minX) * Math.max(0, maxY - minY);

  return roundArea(areaSqCm / SQ_CM_PER_SQ_M);
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');

    if (first === -1 || last === -1 || last <= first) {
      throw new AppError('Claude JSON döndürmedi', 502, 'CLAUDE_JSON_MISSING');
    }

    return JSON.parse(trimmed.slice(first, last + 1));
  }
}

function getClaudeText(message: { content: Array<{ type: string; text?: string }> }): string {
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('\n')
    .trim();
}

function isClaudeImageMediaType(value: string): value is ClaudeImageMediaType {
  return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp' || value === 'image/gif';
}

function mediaTypeFromPath(filePath: string): 'application/pdf' | ClaudeImageMediaType {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/png';
}

async function buildClaudeFileBlock(filePath: string): Promise<ClaudeFileBlock> {
  const data = (await fs.promises.readFile(filePath)).toString('base64');
  const mediaType = mediaTypeFromPath(filePath);

  if (mediaType === 'application/pdf') {
    return {
      type: 'document',
      source: { type: 'base64', media_type: mediaType, data },
    };
  }

  return {
    type: 'image',
    source: { type: 'base64', media_type: isClaudeImageMediaType(mediaType) ? mediaType : 'image/png', data },
  };
}

function numberOrZero(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSetbacks(value: unknown): Setbacks {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return {
    front: numberOrZero(record.front),
    back: numberOrZero(record.back),
    left: numberOrZero(record.left),
    right: numberOrZero(record.right),
  };
}

export async function extractSetbacksFromDocument(filePath: string): Promise<Setbacks> {
  try {
    const Anthropic = require('@anthropic-ai/sdk').default as typeof import('@anthropic-ai/sdk').default;
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const fileBlock = await buildClaudeFileBlock(filePath);

    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      temperature: 0,
      system: SETBACK_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract garden setback distances from this document. Return raw JSON only.',
            },
            fileBlock,
          ],
        },
      ],
    });

    return normalizeSetbacks(extractJsonObject(getClaudeText(message)));
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error('[Claude] Parcel setback extraction failed', { error });
    throw new AppError(
      `Bahçe çekmeleri okunamadı: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
      502,
      'CLAUDE_SETBACK_EXTRACTION_FAILED',
    );
  }
}
