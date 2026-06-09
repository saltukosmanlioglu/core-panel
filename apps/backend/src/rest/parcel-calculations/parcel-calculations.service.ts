import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import mammoth from 'mammoth';
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

export type EdgeRole = 'front' | 'side' | 'back' | 'inactive';

export interface Overhang {
  floor: number;
  front: number;
  back: number;
  left: number;
  right: number;
}

export interface SetbackExtraction {
  front: number;
  back: number;
  left: number;
  right: number;
}

type SetbackSide = keyof SetbackExtraction;
type SetbackSource = 'planNotes' | 'zoningDocument' | 'default';
type DocumentSetbackExtraction = Record<SetbackSide, number | null>;

export interface SetbackExtractionResult {
  final: SetbackExtraction;
  fromPlanNotes: DocumentSetbackExtraction | null;
  fromZoningDocument: DocumentSetbackExtraction | null;
  hasConflict: boolean;
  sources: Record<SetbackSide, SetbackSource>;
}

export interface ZoningExtractionResult {
  setbacks: {
    front: number | null;
    back: number | null;
    left: number | null;
    right: number | null;
  };
  taks: number | null;
  kaks: number | null;
  floorCount: number | null;
  buildingHeight: number | null;
  constructionOrder: string | null;
  buildingDepth: number | null;
  notes: string | null;
}

export interface FullExtractionResult {
  fromImarDurumu: ZoningExtractionResult | null;
  fromPlanNotes: ZoningExtractionResult | null;
  merged: ZoningExtractionResult;
  hasConflict: boolean;
}

export type ParcelDocumentType = 'plan_notlari' | 'imar_durumu';
export type ExtractedDocumentFieldValue = string | number | null;
export type ExtractedDocumentFields = Record<string, ExtractedDocumentFieldValue>;

export interface ParcelDocumentExtractionResult {
  documentType: ParcelDocumentType;
  fields: ExtractedDocumentFields;
  zoningInfo: ZoningExtractionResult;
}

const CM_PER_METER = 100;
const SQ_CM_PER_SQ_M = 10000;

const IMAR_DURUMU_PROMPT = `You are an expert at reading Turkish zoning status documents (imar durumu belgesi).
Extract ALL construction parameters. Return JSON only, no explanation:
{
  "setbacks": {
    "front": number | null,
    "back": number | null,
    "left": number | null,
    "right": number | null
  },
  "taks": number | null,
  "kaks": number | null,
  "floorCount": number | null,
  "buildingHeight": number | null,
  "constructionOrder": string | null,
  "buildingDepth": number | null,
  "notes": string | null
}
Turkish terms:
- Ön bahçe = front setback
- Arka bahçe = back setback
- Yan bahçe = left AND right setback (unless sol/sağ specified)
- Sol yan = left, Sağ yan = right
- T.A.K.S. = taks (decimal, e.g. 0.40)
- K.A.K.S. or KAKS = kaks (decimal, e.g. 1.50)
- Kat adedi = floorCount (integer)
- Bina yüksekliği = buildingHeight (meters)
- İnşaat nizamı = constructionOrder (A=Ayrık, B=Bitişik, BA=Blok Ayrık etc.)
- Bina derinliği = buildingDepth (meters)
Return null for any value not found.`;

const PLAN_NOTES_PROMPT = `You are an expert at reading Turkish urban planning notes (plan notları/imar planı notları).
Extract ALL construction parameters that apply. Return JSON only, no explanation:
{
  "setbacks": {
    "front": number | null,
    "back": number | null,
    "left": number | null,
    "right": number | null
  },
  "taks": number | null,
  "kaks": number | null,
  "floorCount": number | null,
  "buildingHeight": number | null,
  "constructionOrder": string | null,
  "buildingDepth": number | null,
  "notes": string | null
}
Same Turkish terms as above. Return null for any value not found.`;

const PLAN_NOTLARI_FIELDS_PROMPT = `You are an expert at reading Turkish urban planning notes (plan notları/imar planı notları).
Extract fields that apply to parcel calculation. Return JSON only, no explanation:
{
  "plan_notu": string | null,
  "yapi_yuksekligi": number | null,
  "taks": number | null,
  "kaks": number | null,
  "emsal": number | null,
  "kat_adedi": number | null,
  "setbacks": {
    "front": number | null,
    "back": number | null,
    "left": number | null,
    "right": number | null
  }
}
Use meters for distances and decimal numbers for TAKS/KAKS/emsal. Return null for any value not found.`;

const IMAR_DURUMU_FIELDS_PROMPT = `You are an expert at reading Turkish zoning status documents (imar durumu belgesi).
Extract fields that apply to parcel calculation. Return JSON only, no explanation:
{
  "imar_durumu": string | null,
  "zona_tipi": string | null,
  "yapilasma_kosullari": string | null,
  "parsel_alani": number | null,
  "ada_no": string | null,
  "parsel_no": string | null,
  "taks": number | null,
  "kaks": number | null,
  "kat_adedi": number | null,
  "yapi_yuksekligi": number | null,
  "setbacks": {
    "front": number | null,
    "back": number | null,
    "left": number | null,
    "right": number | null
  }
}
Use meters for distances, square meters for parcel area, and decimal numbers for TAKS/KAKS. Return null for any value not found.`;

type ClaudeImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
type ClaudeDocumentMediaType = 'application/pdf';
type WordMediaType = 'application/msword' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
type SupportedDocumentMediaType = ClaudeDocumentMediaType | ClaudeImageMediaType | WordMediaType;

type ClaudeFileBlock =
  | {
    type: 'document';
    source: {
      type: 'base64';
      media_type: ClaudeDocumentMediaType;
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

function getSetbackForEdgeRole(
  edgeIndex: number,
  edgeRoles: EdgeRole[],
  setbacks: Setbacks,
  activeEdges?: boolean[],
): number {
  if (activeEdges && activeEdges[edgeIndex] === false) return 0;

  const role = edgeRoles[edgeIndex] ?? 'side';
  if (role === 'inactive') return 0;
  if (role === 'front') return setbacks.front * CM_PER_METER;
  if (role === 'back') return setbacks.back * CM_PER_METER;

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

export function calculateFootprint(
  vertices: Point[],
  setbacks: Setbacks,
  edgeRoles: EdgeRole[],
  activeEdges?: boolean[],
): Point[] {
  if (vertices.length < 3) return [];

  const clockwise = signedArea(vertices) < 0;
  const inset: Point[] = vertices.map((curr, index) => {
    const prev = vertices[(index - 1 + vertices.length) % vertices.length]!;
    const next = vertices[(index + 1) % vertices.length]!;
    const prevEdgeIndex = (index - 1 + vertices.length) % vertices.length;
    const nextEdgeIndex = index;

    const prevSetback = getSetbackForEdgeRole(prevEdgeIndex, edgeRoles, setbacks, activeEdges);
    const nextSetback = getSetbackForEdgeRole(nextEdgeIndex, edgeRoles, setbacks, activeEdges);

    if (prevSetback === 0 && nextSetback === 0) {
      return { x: round(curr.x), y: round(curr.y) };
    }

    const prevNormal = normalizedInwardNormal(prev, curr, clockwise);
    const nextNormal = normalizedInwardNormal(curr, next, clockwise);
    const prevDirection = normalizedEdgeVector(prev, curr);
    const nextDirection = normalizedEdgeVector(curr, next);

    if (nextSetback === 0) {
      const prevOffset = { x: prevNormal.x * prevSetback, y: prevNormal.y * prevSetback };
      const offsetPrevStart = { x: prev.x + prevOffset.x, y: prev.y + prevOffset.y };
      const dx = curr.x - offsetPrevStart.x;
      const dy = curr.y - offsetPrevStart.y;
      const dot = dx * prevDirection.x + dy * prevDirection.y;
      return {
        x: round(offsetPrevStart.x + prevDirection.x * dot),
        y: round(offsetPrevStart.y + prevDirection.y * dot),
      };
    }

    if (prevSetback === 0) {
      const nextOffset = { x: nextNormal.x * nextSetback, y: nextNormal.y * nextSetback };
      return {
        x: round(curr.x + nextOffset.x),
        y: round(curr.y + nextOffset.y),
      };
    }

    const prevOffset = { x: prevNormal.x * prevSetback, y: prevNormal.y * prevSetback };
    const nextOffset = { x: nextNormal.x * nextSetback, y: nextNormal.y * nextSetback };

    const miterPoint = lineIntersection(
      { x: prev.x + prevOffset.x, y: prev.y + prevOffset.y },
      prevDirection,
      { x: curr.x + nextOffset.x, y: curr.y + nextOffset.y },
      nextDirection,
    ) ?? {
      x: curr.x + prevOffset.x + nextOffset.x,
      y: curr.y + prevOffset.y + nextOffset.y,
    };

    const point = { x: round(miterPoint.x), y: round(miterPoint.y) };
    return pointInPolygon(point, vertices)
      ? point
      : nearestPointOnPolygonBoundary(point, vertices);
  });

  for (let i = 0; i < vertices.length; i++) {
    if (edgeRoles[i] === 'inactive' || activeEdges?.[i] === false) {
        const prevEdgeIdx = (i - 1 + vertices.length) % vertices.length;
        const nextEdgeIdx = (i + 1) % vertices.length;

        const prevSb = getSetbackForEdgeRole(prevEdgeIdx, edgeRoles, setbacks, activeEdges);
        const nextSb = getSetbackForEdgeRole(nextEdgeIdx, edgeRoles, setbacks, activeEdges);

        if (prevSb > 0 && nextSb > 0) {
          const vPrevPrev = vertices[(i - 1 + vertices.length) % vertices.length]!;
          const vPrev = vertices[i]!;
          const vNext = vertices[(i + 1) % vertices.length]!;
          const vNextNext = vertices[(i + 2) % vertices.length]!;

          const prevNorm = normalizedInwardNormal(vPrevPrev, vPrev, clockwise);
          const nextNorm = normalizedInwardNormal(vNext, vNextNext, clockwise);
          const prevDir = normalizedEdgeVector(vPrevPrev, vPrev);
          const nextDir = normalizedEdgeVector(vNext, vNextNext);

          const prevOffsetPt = { x: vPrevPrev.x + prevNorm.x * prevSb, y: vPrevPrev.y + prevNorm.y * prevSb };
          const nextOffsetPt = { x: vNext.x + nextNorm.x * nextSb, y: vNext.y + nextNorm.y * nextSb };

          const intersection = lineIntersection(prevOffsetPt, prevDir, nextOffsetPt, nextDir);

          if (intersection) {
            const collapsePoint = pointInPolygon(intersection, vertices)
              ? intersection
              : nearestPointOnPolygonBoundary(intersection, vertices);
            inset[i] = { x: round(collapsePoint.x), y: round(collapsePoint.y) };
            inset[(i + 1) % vertices.length] = { x: round(collapsePoint.x), y: round(collapsePoint.y) };
          }
        }
    }
  }

  return inset.map((point) => ({ x: round(point.x), y: round(point.y) }));
}

export function calculateOverhangArea(footprintVertices: Point[], overhang: Overhang): number {
  if (footprintVertices.length < 3) return 0;

  // Use the maximum overhang depth as a uniform outward polygon offset.
  // This is conservative (slightly over-estimates for asymmetric overhangs) but
  // correct for the common case of uniform çıkma, and avoids the large error
  // introduced by bounding-box expansion on non-rectangular footprints.
  const maxOffsetCm = Math.max(overhang.front, overhang.back, overhang.left, overhang.right) * CM_PER_METER;
  if (maxOffsetCm <= 0) return calculatePolygonArea(footprintVertices);

  const clockwise = signedArea(footprintVertices) < 0;
  const n = footprintVertices.length;

  const expanded: Point[] = footprintVertices.map((curr, i) => {
    const prev = footprintVertices[(i - 1 + n) % n]!;
    const next = footprintVertices[(i + 1) % n]!;

    // Inward normals for the two adjacent edges; negate them for outward offset.
    const prevNormal = normalizedInwardNormal(prev, curr, clockwise);
    const nextNormal = normalizedInwardNormal(curr, next, clockwise);
    const prevOffset = { x: -prevNormal.x * maxOffsetCm, y: -prevNormal.y * maxOffsetCm };
    const nextOffset = { x: -nextNormal.x * maxOffsetCm, y: -nextNormal.y * maxOffsetCm };

    const prevDirection = normalizedEdgeVector(prev, curr);
    const nextDirection = normalizedEdgeVector(curr, next);

    // Find the miter intersection of the two outward-offset edge lines.
    const miterPoint = lineIntersection(
      { x: prev.x + prevOffset.x, y: prev.y + prevOffset.y },
      prevDirection,
      { x: curr.x + nextOffset.x, y: curr.y + nextOffset.y },
      nextDirection,
    ) ?? { x: curr.x + prevOffset.x + nextOffset.x, y: curr.y + prevOffset.y + nextOffset.y };

    return { x: round(miterPoint.x), y: round(miterPoint.y) };
  });

  return roundArea(calculatePolygonArea(expanded));
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

function mediaTypeFromPath(filePath: string): SupportedDocumentMediaType {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.doc') return 'application/msword';
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/png';
}

async function extractTextFromFile(filePath: string, mimeType: SupportedDocumentMediaType): Promise<string> {
  if (mimeType.includes('word') || mimeType.includes('msword')) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  return '';
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

  if (isClaudeImageMediaType(mediaType)) {
    return {
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data },
    };
  }

  throw new AppError('Desteklenmeyen belge türü', 400, 'UNSUPPORTED_DOCUMENT_TYPE');
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asPlainRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeDocumentSetbacks(value: unknown): DocumentSetbackExtraction {
  const record = asPlainRecord(value);

  return {
    front: nullableNumber(record.front),
    back: nullableNumber(record.back),
    left: nullableNumber(record.left),
    right: nullableNumber(record.right),
  };
}

function normalizeZoningExtraction(value: unknown): ZoningExtractionResult {
  const record = asPlainRecord(value);
  const setbacks = asPlainRecord(record.setbacks);

  return {
    setbacks: {
      front: nullableNumber(setbacks.front ?? record.front ?? record.on_bahce_cekme),
      back: nullableNumber(setbacks.back ?? record.back ?? record.arka_bahce_cekme),
      left: nullableNumber(setbacks.left ?? record.left ?? record.sol_bahce_cekme ?? record.yan_bahce_cekme),
      right: nullableNumber(setbacks.right ?? record.right ?? record.sag_bahce_cekme ?? record.yan_bahce_cekme),
    },
    taks: nullableNumber(record.taks),
    kaks: nullableNumber(record.kaks ?? record.emsal),
    floorCount: nullableNumber(record.floorCount ?? record.kat_adedi),
    buildingHeight: nullableNumber(record.buildingHeight ?? record.yapi_yuksekligi),
    constructionOrder: nullableText(record.constructionOrder ?? record.zona_tipi ?? record.insaat_nizami),
    buildingDepth: nullableNumber(record.buildingDepth),
    notes: nullableText(record.notes ?? record.plan_notu ?? record.imar_durumu ?? record.yapilasma_kosullari),
  };
}

function numberField(record: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = nullableNumber(record[key]);
    if (value !== null) return value;
  }
  return null;
}

function textField(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = nullableText(record[key]);
    if (value !== null) return value;
  }
  return null;
}

function normalizeExtractedDocumentFields(
  documentType: ParcelDocumentType,
  value: unknown,
  zoningInfo: ZoningExtractionResult,
): ExtractedDocumentFields {
  const record = asPlainRecord(value);

  if (documentType === 'plan_notlari') {
    return {
      plan_notu: textField(record, 'plan_notu', 'notes'),
      yapi_yuksekligi: numberField(record, 'yapi_yuksekligi', 'buildingHeight') ?? zoningInfo.buildingHeight,
      taks: numberField(record, 'taks') ?? zoningInfo.taks,
      kaks: numberField(record, 'kaks') ?? zoningInfo.kaks,
      emsal: numberField(record, 'emsal', 'kaks') ?? zoningInfo.kaks,
      kat_adedi: numberField(record, 'kat_adedi', 'floorCount') ?? zoningInfo.floorCount,
      on_bahce_cekme: zoningInfo.setbacks.front,
      arka_bahce_cekme: zoningInfo.setbacks.back,
      sol_bahce_cekme: zoningInfo.setbacks.left,
      sag_bahce_cekme: zoningInfo.setbacks.right,
    };
  }

  return {
    imar_durumu: textField(record, 'imar_durumu', 'notes'),
    zona_tipi: textField(record, 'zona_tipi', 'constructionOrder') ?? zoningInfo.constructionOrder,
    yapilasma_kosullari: textField(record, 'yapilasma_kosullari', 'notes') ?? zoningInfo.notes,
    parsel_alani: numberField(record, 'parsel_alani', 'parcelArea'),
    ada_no: textField(record, 'ada_no', 'blockNo'),
    parsel_no: textField(record, 'parsel_no', 'parcelNo'),
    taks: numberField(record, 'taks') ?? zoningInfo.taks,
    kaks: numberField(record, 'kaks') ?? zoningInfo.kaks,
    kat_adedi: numberField(record, 'kat_adedi', 'floorCount') ?? zoningInfo.floorCount,
    yapi_yuksekligi: numberField(record, 'yapi_yuksekligi', 'buildingHeight') ?? zoningInfo.buildingHeight,
    on_bahce_cekme: zoningInfo.setbacks.front,
    arka_bahce_cekme: zoningInfo.setbacks.back,
    sol_bahce_cekme: zoningInfo.setbacks.left,
    sag_bahce_cekme: zoningInfo.setbacks.right,
  };
}

function promptForDocumentType(documentType: ParcelDocumentType): string {
  return documentType === 'plan_notlari'
    ? PLAN_NOTLARI_FIELDS_PROMPT
    : IMAR_DURUMU_FIELDS_PROMPT;
}

async function extractSingleDocument<T>(
  filePath: string,
  systemPrompt: string,
): Promise<T> {
  try {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const mimeType = mediaTypeFromPath(filePath);
    const extractedText = await extractTextFromFile(filePath, mimeType);
    const content = extractedText.trim()
      ? `Aşağıdaki belgeden imar ve yapılaşma parametrelerini çıkar:\n\n${extractedText}`
      : [
        {
          type: 'text' as const,
          text: 'Bu belgeden imar ve yapılaşma parametrelerini çıkar. Return raw JSON only.',
        },
        await buildClaudeFileBlock(filePath),
      ];

    const message = await client.messages.create({
      model: env.CLAUDE_MODEL,
      max_tokens: 1000,
      temperature: 0,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    });

    return extractJsonObject(getClaudeText(message)) as T;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error('[Claude] Parcel document extraction failed', { error });
    throw new AppError(
      `Belge okunamadı: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
      502,
      'CLAUDE_DOCUMENT_EXTRACTION_FAILED',
    );
  }
}

async function extractZoningDocument(filePath: string, systemPrompt: string): Promise<ZoningExtractionResult> {
  return normalizeZoningExtraction(await extractSingleDocument<unknown>(filePath, systemPrompt));
}

export async function extractParcelDocumentByType(
  filePath: string,
  documentType: ParcelDocumentType,
): Promise<ParcelDocumentExtractionResult> {
  const raw = await extractSingleDocument<unknown>(filePath, promptForDocumentType(documentType));
  const zoningInfo = normalizeZoningExtraction(raw);

  return {
    documentType,
    fields: normalizeExtractedDocumentFields(documentType, raw, zoningInfo),
    zoningInfo,
  };
}

function hasValue(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

export async function extractSetbacksFromDocuments(
  planNotesPath?: string,
  zoningDocumentPath?: string,
): Promise<SetbackExtractionResult> {
  const fromPlanNotes = planNotesPath
    ? normalizeDocumentSetbacks((await extractZoningDocument(planNotesPath, PLAN_NOTES_PROMPT)).setbacks)
    : null;
  const fromZoningDocument = zoningDocumentPath
    ? normalizeDocumentSetbacks((await extractZoningDocument(zoningDocumentPath, IMAR_DURUMU_PROMPT)).setbacks)
    : null;
  const sides: SetbackSide[] = ['front', 'back', 'left', 'right'];
  const final = {} as SetbackExtraction;
  const sources = {} as Record<SetbackSide, SetbackSource>;
  let hasConflict = false;

  sides.forEach((side) => {
    const planNotesValue = fromPlanNotes?.[side] ?? null;
    const zoningDocumentValue = fromZoningDocument?.[side] ?? null;

    if (hasValue(planNotesValue) && hasValue(zoningDocumentValue) && Math.abs(planNotesValue - zoningDocumentValue) > 0.001) {
      hasConflict = true;
    }

    if (hasValue(planNotesValue)) {
      final[side] = planNotesValue;
      sources[side] = 'planNotes';
      return;
    }

    if (hasValue(zoningDocumentValue)) {
      final[side] = zoningDocumentValue;
      sources[side] = 'zoningDocument';
      return;
    }

    final[side] = 3;
    sources[side] = 'default';
  });

  return {
    final,
    fromPlanNotes,
    fromZoningDocument,
    hasConflict,
    sources,
  };
}

export async function extractFullZoningInfo(
  imarDurumuPath?: string,
  planNotesPath?: string,
): Promise<FullExtractionResult> {
  const fromImarDurumu = imarDurumuPath
    ? await extractZoningDocument(imarDurumuPath, IMAR_DURUMU_PROMPT)
    : null;

  const fromPlanNotes = planNotesPath
    ? await extractZoningDocument(planNotesPath, PLAN_NOTES_PROMPT)
    : null;

  const merged: ZoningExtractionResult = {
    setbacks: {
      front: fromImarDurumu?.setbacks.front ?? fromPlanNotes?.setbacks.front ?? null,
      back: fromImarDurumu?.setbacks.back ?? fromPlanNotes?.setbacks.back ?? null,
      left: fromImarDurumu?.setbacks.left ?? fromPlanNotes?.setbacks.left ?? null,
      right: fromImarDurumu?.setbacks.right ?? fromPlanNotes?.setbacks.right ?? null,
    },
    taks: fromImarDurumu?.taks ?? fromPlanNotes?.taks ?? null,
    kaks: fromImarDurumu?.kaks ?? fromPlanNotes?.kaks ?? null,
    floorCount: fromImarDurumu?.floorCount ?? fromPlanNotes?.floorCount ?? null,
    buildingHeight: fromImarDurumu?.buildingHeight ?? fromPlanNotes?.buildingHeight ?? null,
    constructionOrder: fromImarDurumu?.constructionOrder ?? fromPlanNotes?.constructionOrder ?? null,
    buildingDepth: fromImarDurumu?.buildingDepth ?? fromPlanNotes?.buildingDepth ?? null,
    notes: [fromImarDurumu?.notes, fromPlanNotes?.notes].filter(Boolean).join(' | ') || null,
  };

  const hasConflict = !!(
    fromImarDurumu && fromPlanNotes && (
      (fromImarDurumu.setbacks.front !== null && fromPlanNotes.setbacks.front !== null
        && fromImarDurumu.setbacks.front !== fromPlanNotes.setbacks.front)
      || (fromImarDurumu.taks !== null && fromPlanNotes.taks !== null
        && fromImarDurumu.taks !== fromPlanNotes.taks)
    )
  );

  return { fromImarDurumu, fromPlanNotes, merged, hasConflict };
}
