import fs from 'fs';
import { env } from '../../config/env';
import { AppError } from '../../lib/AppError';
import type { CalculatedResults, ExtractedData, FloorSetbacks } from './area-calculations.types';

const CLAUDE_MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are an expert Turkish construction permit and zoning analysis assistant. Your primary role is to read and extract structured data from Turkish construction documents (İnşaat İstikamet Rölovesi, E-İmar Belgesi, Plan Notları) and return them as structured JSON.

YOUR ROLE:
You are the document reading and interpretation layer. You do NOT perform mathematical calculations. Instead, you extract raw data from uploaded documents and return it as structured JSON so that the backend calculation engine can process it.

INPUT DOCUMENTS:
You will receive one or more of the following documents:

1. İnşaat İstikamet Rölovesi (Construction Alignment Survey)
Extract:
- Corner coordinates (Nokta No, Y, X values in meters)
- Road dedication/setback values shown in parentheses (terk mesafeleri)
- Block front line position (Blok Ön Çizgisi) in meters from edge
- Block rear line position (Blok Arka Çizgisi) in meters from edge
- Which edge faces the road (ön cephe)
- Net parcel area if shown

2. E-İmar Belgesi (Zoning Status Document)
Extract:
- Ada/Parsel number
- Parcel area (use the area shown in parentheses = net functional area for KAKS calculation)
- KAKS (Emsal) value
- T.A.K.S. min and max values
- Ön Bahçe (front garden setback)
- Yan Bahçe (side garden setback)
- Arka Bahçe (rear garden setback) — if "-" write null
- Kat Adedi (number of floors)
- Bina Yüksekliği (building height)
- İnşaat Nizamı (construction type: A=Ayrık, B=Bitişik, BL=Blok)
- Plan name (Mer'i İmar Planı)
- If any field says "Bkz. Plan Notu" set value to "see_plan_notes"

3. Plan Notları (Zoning Plan Notes)
Extract based on parcel area category:
- Applicable KAKS value for the parcel size
- Applicable T.A.K.S. range
- Max building height (MaxH)
- Ön Bahçe, Yan Bahçe, Arka Bahçe values
- Whether setbacks increase per floor above 5 floors (and by how much)
- Whether projections (çıkmalar) are included in KAKS calculation
- Any special notes affecting calculations

OUTPUT FORMAT:
Always return a single valid JSON object. Never return plain text explanations outside the JSON. If a value cannot be found, use null.
Return exactly this structure (fill with extracted values):
{
  "document_type": "rolovesi | eimar | plan_notes | combined",
  "parcel": {
    "ada": null, "parsel": null, "ilce": null, "mahalle": null,
    "plan_name": null, "tapu_alani": null, "net_alan": null, "fonksiyon": null
  },
  "coordinates": [],
  "front_facade": { "edge_start_point": null, "edge_end_point": null, "description": null },
  "block_lines": { "on_cizgisi_m": null, "arka_cizgisi_m": null, "on_cizgisi_reference": null, "arka_cizgisi_reference": null },
  "dedications": [],
  "setbacks": { "on_bahce": null, "yan_bahce": null, "arka_bahce": null, "effective_west": null, "note": null },
  "setback_increase_per_floor": { "applies": false, "above_floor": null, "increase_per_floor_m": null, "affected_setbacks": [] },
  "zoning": { "kaks": null, "taks_min": null, "taks_max": null, "kat_adedi": null, "bina_yuksekligi": null, "insaat_nizami": null, "kaks_source": null, "projection_included_in_kaks": null },
  "coefficient": { "value": 1.0, "note": null },
  "warnings": []
}

RULES:
1. Only return JSON. No explanations, no preamble, no markdown code fences. Raw JSON only.
2. Never calculate. Do not compute polygon area, setback areas, or floor counts. Only extract and structure data.
3. Parcel area for KAKS: Always use the area shown in parentheses in the E-İmar document.
4. Arka bahçe null: If E-İmar shows "-" for arka bahçe, set to null and add a warning.
5. "Bkz. Plan Notu": If any zoning value references plan notes, set to "see_plan_notes".
6. Setback per floor: Always include setback_increase_per_floor if found in plan notes.
7. Coordinate system: Y = East, X = North. Keep original sign values.
8. Multiple documents: Merge all extracted data into single JSON response.
9. Front facade: Identify which edge faces the road.`;

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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function normalizeExtractedData(value: unknown): ExtractedData {
  const root = asRecord(value);
  const parcel = asRecord(root.parcel);
  const frontFacade = asRecord(root.front_facade);
  const blockLines = asRecord(root.block_lines);
  const setbacks = asRecord(root.setbacks);
  const increase = asRecord(root.setback_increase_per_floor);
  const zoning = asRecord(root.zoning);
  const coefficient = asRecord(root.coefficient);

  return {
    document_type: typeof root.document_type === 'string' ? root.document_type : 'combined',
    parcel: {
      ada: typeof parcel.ada === 'string' || typeof parcel.ada === 'number' ? parcel.ada : null,
      parsel: typeof parcel.parsel === 'string' || typeof parcel.parsel === 'number' ? parcel.parsel : null,
      ilce: typeof parcel.ilce === 'string' ? parcel.ilce : null,
      mahalle: typeof parcel.mahalle === 'string' ? parcel.mahalle : null,
      plan_name: typeof parcel.plan_name === 'string' ? parcel.plan_name : null,
      tapu_alani: typeof parcel.tapu_alani === 'string' || typeof parcel.tapu_alani === 'number' ? parcel.tapu_alani : null,
      net_alan: typeof parcel.net_alan === 'string' || typeof parcel.net_alan === 'number' ? parcel.net_alan : null,
      fonksiyon: typeof parcel.fonksiyon === 'string' ? parcel.fonksiyon : null,
    },
    coordinates: asArray(root.coordinates),
    front_facade: {
      edge_start_point: typeof frontFacade.edge_start_point === 'string' || typeof frontFacade.edge_start_point === 'number' ? frontFacade.edge_start_point : null,
      edge_end_point: typeof frontFacade.edge_end_point === 'string' || typeof frontFacade.edge_end_point === 'number' ? frontFacade.edge_end_point : null,
      description: typeof frontFacade.description === 'string' ? frontFacade.description : null,
    },
    block_lines: {
      on_cizgisi_m: typeof blockLines.on_cizgisi_m === 'string' || typeof blockLines.on_cizgisi_m === 'number' ? blockLines.on_cizgisi_m : null,
      arka_cizgisi_m: typeof blockLines.arka_cizgisi_m === 'string' || typeof blockLines.arka_cizgisi_m === 'number' ? blockLines.arka_cizgisi_m : null,
      on_cizgisi_reference: typeof blockLines.on_cizgisi_reference === 'string' ? blockLines.on_cizgisi_reference : null,
      arka_cizgisi_reference: typeof blockLines.arka_cizgisi_reference === 'string' ? blockLines.arka_cizgisi_reference : null,
    },
    dedications: asArray(root.dedications),
    setbacks: {
      on_bahce: typeof setbacks.on_bahce === 'string' || typeof setbacks.on_bahce === 'number' ? setbacks.on_bahce : null,
      yan_bahce: typeof setbacks.yan_bahce === 'string' || typeof setbacks.yan_bahce === 'number' ? setbacks.yan_bahce : null,
      arka_bahce: typeof setbacks.arka_bahce === 'string' || typeof setbacks.arka_bahce === 'number' ? setbacks.arka_bahce : null,
      effective_west: typeof setbacks.effective_west === 'string' || typeof setbacks.effective_west === 'number' ? setbacks.effective_west : null,
      note: typeof setbacks.note === 'string' ? setbacks.note : null,
    },
    setback_increase_per_floor: {
      applies: increase.applies === true,
      above_floor: typeof increase.above_floor === 'string' || typeof increase.above_floor === 'number' ? increase.above_floor : null,
      increase_per_floor_m: typeof increase.increase_per_floor_m === 'string' || typeof increase.increase_per_floor_m === 'number' ? increase.increase_per_floor_m : null,
      affected_setbacks: asArray(increase.affected_setbacks).filter((item): item is string => typeof item === 'string'),
    },
    zoning: {
      kaks: typeof zoning.kaks === 'string' || typeof zoning.kaks === 'number' ? zoning.kaks : null,
      taks_min: typeof zoning.taks_min === 'string' || typeof zoning.taks_min === 'number' ? zoning.taks_min : null,
      taks_max: typeof zoning.taks_max === 'string' || typeof zoning.taks_max === 'number' ? zoning.taks_max : null,
      kat_adedi: typeof zoning.kat_adedi === 'string' || typeof zoning.kat_adedi === 'number' ? zoning.kat_adedi : null,
      bina_yuksekligi: typeof zoning.bina_yuksekligi === 'string' || typeof zoning.bina_yuksekligi === 'number' ? zoning.bina_yuksekligi : null,
      insaat_nizami: typeof zoning.insaat_nizami === 'string' ? zoning.insaat_nizami : null,
      kaks_source: typeof zoning.kaks_source === 'string' ? zoning.kaks_source : null,
      projection_included_in_kaks:
        typeof zoning.projection_included_in_kaks === 'boolean' || typeof zoning.projection_included_in_kaks === 'string'
          ? zoning.projection_included_in_kaks
          : null,
    },
    coefficient: {
      value: typeof coefficient.value === 'string' || typeof coefficient.value === 'number' ? coefficient.value : 1,
      note: typeof coefficient.note === 'string' ? coefficient.note : null,
    },
    warnings: asArray(root.warnings).filter((item): item is string => typeof item === 'string'),
  };
}

async function buildClaudeFileBlock(file: Express.Multer.File): Promise<ClaudeFileBlock> {
  const data = (await fs.promises.readFile(file.path)).toString('base64');

  if (file.mimetype === 'application/pdf') {
    return {
      type: 'document',
      source: { type: 'base64', media_type: file.mimetype, data },
    };
  }

  const mediaType = isClaudeImageMediaType(file.mimetype) ? file.mimetype : 'image/png';
  return {
    type: 'image',
    source: { type: 'base64', media_type: mediaType, data },
  };
}

function isClaudeImageMediaType(value: string): value is ClaudeImageMediaType {
  return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp' || value === 'image/gif';
}

export async function extractDataWithClaude(files: Express.Multer.File[]): Promise<ExtractedData> {
  try {
    const Anthropic = require('@anthropic-ai/sdk').default as typeof import('@anthropic-ai/sdk').default;
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const fileBlocks = await Promise.all(files.map(buildClaudeFileBlock));

    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract and merge the uploaded Turkish construction document data. Return raw JSON only.',
            },
            ...fileBlocks,
          ],
        },
      ],
    });

    return normalizeExtractedData(extractJsonObject(getClaudeText(message)));
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error('[Claude] Area calculation extraction failed', { error });
    throw new AppError(
      `Claude belge analizi başarısız: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
      502,
      'CLAUDE_AREA_ANALYSIS_FAILED',
    );
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const cleaned = value
    .trim()
    .replace(/\s/g, '')
    .replace(/[^0-9,.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === ',' || cleaned === '.') {
    return null;
  }
  const commaIndex = cleaned.lastIndexOf(',');
  const dotIndex = cleaned.lastIndexOf('.');
  let normalized = cleaned;

  if (commaIndex >= 0 && dotIndex >= 0) {
    normalized = commaIndex > dotIndex
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (commaIndex >= 0) {
    normalized = cleaned.replace(',', '.');
  } else {
    const dotCount = (cleaned.match(/\./g) ?? []).length;
    if (dotCount > 1) {
      const lastDot = cleaned.lastIndexOf('.');
      normalized = `${cleaned.slice(0, lastDot).replace(/\./g, '')}${cleaned.slice(lastDot)}`;
    }
  }

  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function round2(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100) / 100;
}

function multiply(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : round2(a * b);
}

interface CalculationCoordinate {
  nokta_no: number;
  Y: number;
  X: number;
}

interface NormalizedDedication {
  value_m: number | null;
  edge: string | null;
}

interface NumericSetbacks {
  frontSetback: number | null;
  sideSetback: number | null;
  rearSetback: number | null;
}

interface NumericBlockLines {
  frontLineM: number | null;
  rearLineM: number | null;
}

interface NumericSetbackIncrease {
  applies: boolean;
  aboveFloor: number | null;
  increasePerFloorM: number | null;
  affectedSetbacks: string[];
}

interface BuildableAreaResult {
  buildableWidth: number | null;
  buildableDepth: number | null;
  buildableArea: number | null;
  source: 'block_lines' | 'setbacks';
}

function readRecordValue(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return null;
}

function normalizeCoordinate(value: unknown, index: number): CalculationCoordinate | null {
  const record = asRecord(value);
  const y = toNumber(readRecordValue(record, ['Y', 'y']));
  const x = toNumber(readRecordValue(record, ['X', 'x']));
  const pointIndex = toNumber(readRecordValue(record, ['nokta_no', 'point_no', 'pointIndex', 'no', 'id']));

  if (y === null || x === null) {
    return null;
  }

  return {
    nokta_no: pointIndex === null ? index + 1 : Math.round(pointIndex),
    Y: y,
    X: x,
  };
}

function calculateDistance(first: CalculationCoordinate, second: CalculationCoordinate): number {
  return Math.sqrt((second.Y - first.Y) ** 2 + (second.X - first.X) ** 2);
}

function normalizeDedications(dedications: unknown[]): NormalizedDedication[] {
  return dedications.map((dedication) => {
    const record = asRecord(dedication);
    return {
      value_m: toNumber(readRecordValue(record, [
        'value_m',
        'value',
        'amount_m',
        'miktar_m',
        'terk_m',
        'dedication_m',
        'distance_m',
        'width_m',
      ])),
      edge: String(readRecordValue(record, ['edge', 'kenar', 'direction', 'yon', 'description']) ?? '').trim() || null,
    };
  });
}

function findEdgeLength(coords: CalculationCoordinate[], edgeDescription: string | null): number | null {
  if (!coords || coords.length < 2 || !edgeDescription) return null;

  const desc = edgeDescription.toLowerCase();
  let edgePoints: CalculationCoordinate[] = [];

  if (desc.includes('güney') || desc.includes('guney') || desc.includes('south')) {
    const sorted = [...coords].sort((first, second) => first.X - second.X);
    edgePoints = sorted.slice(0, 2);
  } else if (desc.includes('kuzey') || desc.includes('north')) {
    const sorted = [...coords].sort((first, second) => second.X - first.X);
    edgePoints = sorted.slice(0, 2);
  } else if (desc.includes('doğu') || desc.includes('dogu') || desc.includes('east')) {
    const sorted = [...coords].sort((first, second) => second.Y - first.Y);
    edgePoints = sorted.slice(0, 2);
  } else if (desc.includes('batı') || desc.includes('bati') || desc.includes('west')) {
    const sorted = [...coords].sort((first, second) => first.Y - second.Y);
    edgePoints = sorted.slice(0, 2);
  }

  if (edgePoints.length < 2) return null;

  return calculateDistance(edgePoints[0]!, edgePoints[1]!);
}

function calculateDedicationArea(coords: CalculationCoordinate[], dedications: NormalizedDedication[]): number {
  if (!dedications || dedications.length === 0) return 0;

  let totalDedicationArea = 0;

  for (const dedication of dedications) {
    const edgeLength = findEdgeLength(coords, dedication.edge);
    if (edgeLength && dedication.value_m) {
      totalDedicationArea += dedication.value_m * edgeLength;
    }
  }

  return totalDedicationArea;
}

function calculatePolygonArea(coords: CalculationCoordinate[]): number | null {
  if (!coords || coords.length < 3) return null;
  console.log('[AREA CALC] Raw coordinates:', coords);
  let area = 0;
  const n = coords.length;
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    const yi = parseFloat(String(coords[i]!.Y));
    const xi = parseFloat(String(coords[i]!.X));
    const yj = parseFloat(String(coords[j]!.Y));
    const xj = parseFloat(String(coords[j]!.X));
    if (!Number.isFinite(yi) || !Number.isFinite(xi) || !Number.isFinite(yj) || !Number.isFinite(xj)) continue;
    area += yi * xj;
    area -= yj * xi;
  }
  const result = round2(Math.abs(area / 2));
  console.log('[AREA CALC] Polygon area (Shoelace):', result);
  return result;
}

function calculateNetArea(
  polygonArea: number | null,
  coordinates: CalculationCoordinate[],
  dedications: NormalizedDedication[],
  warnings: string[],
): { grossArea: number | null; dedicationArea: number | null; netArea: number | null } {
  if (polygonArea === null) {
    return { grossArea: null, dedicationArea: null, netArea: null };
  }

  if (!dedications || dedications.length === 0) {
    return { grossArea: polygonArea, dedicationArea: 0, netArea: polygonArea };
  }

  const dedicationArea = round2(calculateDedicationArea(coordinates, dedications));

  console.log('[AREA CALC] Gross:', polygonArea, 'Dedication:', dedicationArea);

  if ((dedicationArea ?? 0) >= polygonArea) {
    const warning = 'Terk alanı hesabı hatalı, ham parsel alanı kullanıldı';
    console.warn('[AREA CALC] WARNING: dedicationArea', dedicationArea, '>= polygonArea', polygonArea, '— skipping dedication subtraction');
    if (!warnings.includes(warning)) warnings.push(warning);
    return { grossArea: polygonArea, dedicationArea, netArea: polygonArea };
  }

  const netArea = round2(Math.max(polygonArea - (dedicationArea ?? 0), 0));

  return { grossArea: polygonArea, dedicationArea, netArea };
}

function estimateFrontEdgeLength(coordinates: CalculationCoordinate[]): number | null {
  if (!coordinates || coordinates.length < 2) return null;
  const sorted = [...coordinates].sort((first, second) => first.X - second.X);
  const firstPoint = sorted[0];
  const secondPoint = sorted[1];
  if (!firstPoint || !secondPoint) return null;
  return calculateDistance(firstPoint, secondPoint);
}

function calculateBuildableAreaFromBlockLines(
  polygonArea: number | null,
  blockLines: NumericBlockLines | null,
  setbacks: NumericSetbacks,
  coordinates: CalculationCoordinate[],
): BuildableAreaResult {
  if (blockLines?.frontLineM != null && blockLines?.rearLineM != null) {
    const buildableDepth = blockLines.rearLineM - blockLines.frontLineM;
    const frontEdgeLength = estimateFrontEdgeLength(coordinates);
    const sideSetback = setbacks.sideSetback ?? 0;
    const buildableWidth = frontEdgeLength ? frontEdgeLength - sideSetback * 2 : null;
    const buildableArea = buildableWidth !== null && buildableWidth > 0 && buildableDepth > 0
      ? buildableWidth * buildableDepth
      : null;

    return {
      buildableWidth: buildableWidth !== null && buildableWidth > 0 ? round2(buildableWidth) : null,
      buildableDepth: buildableDepth > 0 ? round2(buildableDepth) : null,
      buildableArea: round2(buildableArea),
      source: 'block_lines',
    };
  }

  if (polygonArea === null || polygonArea <= 0) {
    return {
      buildableWidth: null,
      buildableDepth: null,
      buildableArea: null,
      source: 'setbacks',
    };
  }

  const approximateSide = Math.sqrt(polygonArea);
  const frontSetback = setbacks.frontSetback ?? 0;
  const rearSetback = setbacks.rearSetback ?? setbacks.sideSetback ?? 0;
  const sideSetback = setbacks.sideSetback ?? 0;
  const buildableDepth = approximateSide - frontSetback - rearSetback;
  const buildableWidth = approximateSide - sideSetback * 2;

  return {
    buildableWidth: buildableWidth > 0 ? round2(buildableWidth) : null,
    buildableDepth: buildableDepth > 0 ? round2(buildableDepth) : null,
    buildableArea: buildableWidth > 0 && buildableDepth > 0 ? round2(buildableWidth * buildableDepth) : null,
    source: 'setbacks',
  };
}

function isSetbackAffected(affectedSetbacks: string[], candidates: string[]): boolean {
  const normalized = affectedSetbacks.map((item) => item.toLowerCase());
  return candidates.some((candidate) => normalized.includes(candidate));
}

function calculateFloorSetbacks(
  baseSetbacks: NumericSetbacks,
  setbackIncrease: NumericSetbackIncrease,
  floorCount: number | null,
  buildableWidth: number | null,
  buildableDepth: number | null,
): FloorSetbacks[] {
  if (!floorCount || floorCount < 1) return [];

  const results: FloorSetbacks[] = [];
  const baseFront = baseSetbacks.frontSetback ?? 0;
  const baseSide = baseSetbacks.sideSetback ?? 0;
  const baseRear = baseSetbacks.rearSetback ?? baseSide;

  for (let floor = 1; floor <= floorCount; floor += 1) {
    let extraSide = 0;
    let extraRear = 0;

    if (
      setbackIncrease.applies &&
      setbackIncrease.aboveFloor != null &&
      floor > setbackIncrease.aboveFloor &&
      setbackIncrease.increasePerFloorM != null
    ) {
      const extraFloors = floor - setbackIncrease.aboveFloor;
      const increase = extraFloors * setbackIncrease.increasePerFloorM;

      if (isSetbackAffected(setbackIncrease.affectedSetbacks, ['yan_bahce', 'side_setback', 'side'])) {
        extraSide = increase;
      }
      if (isSetbackAffected(setbackIncrease.affectedSetbacks, ['arka_bahce', 'rear_setback', 'rear'])) {
        extraRear = increase;
      }
    }

    const sideSetback = baseSide + extraSide;
    const rearSetback = baseRear + extraRear;
    const floorBuildableWidth = buildableWidth != null ? buildableWidth - extraSide * 2 : null;
    const floorBuildableDepth = buildableDepth != null ? buildableDepth - extraRear : null;

    results.push({
      floor,
      front_setback: round2(baseFront) ?? 0,
      side_setback: round2(sideSetback) ?? 0,
      rear_setback: round2(rearSetback) ?? 0,
      buildable_width: floorBuildableWidth && floorBuildableWidth > 0 ? round2(floorBuildableWidth) : null,
      buildable_depth: floorBuildableDepth && floorBuildableDepth > 0 ? round2(floorBuildableDepth) : null,
    });
  }

  return results;
}

function normalizeProjectionIncludedInKaks(value: boolean | string | null): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return null;

  const normalized = value.toLowerCase();
  if (
    normalized.includes('değil') ||
    normalized.includes('degil') ||
    normalized.includes('hariç') ||
    normalized.includes('haric') ||
    normalized.includes('dışında') ||
    normalized.includes('disinda') ||
    normalized.includes('false') ||
    normalized.includes('no')
  ) {
    return false;
  }

  if (normalized.includes('dahil') || normalized.includes('true') || normalized.includes('yes') || normalized.includes('evet')) {
    return true;
  }

  return null;
}

function calculateProjectionEffect(
  maxInsaatAlani: number | null,
  projectionIncludedInKaks: boolean | null,
  buildableWidth: number | null,
  floorCount: number | null,
): {
  projection_bonus_area: number | null;
  adjusted_max_insaat_alani: number | null;
  projection_note: string;
} {
  if (projectionIncludedInKaks === false && buildableWidth && floorCount) {
    const projectionDepth = 1.5;
    const eligibleFloors = Math.max(floorCount - 1, 0);
    const projectionArea = round2(buildableWidth * projectionDepth * eligibleFloors) ?? 0;

    return {
      projection_bonus_area: projectionArea,
      adjusted_max_insaat_alani: maxInsaatAlani != null ? round2(maxInsaatAlani + projectionArea) : null,
      projection_note: `Çıkmalar KAKS dışında. ${eligibleFloors} katta ${projectionDepth}m çıkma ile +${projectionArea.toFixed(2)}m² eklendi.`,
    };
  }

  if (projectionIncludedInKaks === true) {
    return {
      projection_bonus_area: 0,
      adjusted_max_insaat_alani: maxInsaatAlani,
      projection_note: 'Çıkmalar KAKS hesabına dahil.',
    };
  }

  return {
    projection_bonus_area: null,
    adjusted_max_insaat_alani: maxInsaatAlani,
    projection_note: 'Çıkma bilgisi belgede belirtilmemiş.',
  };
}

function buildAreaDiscrepancyWarning(discrepancy: number): string {
  return `Hesaplanan net alan (röleveden) ile E-İmar belgesindeki net alan arasında ${discrepancy.toFixed(2)} m² fark var. Röleve koordinatları esas alındı.`;
}

export function calculateResults(extracted: ExtractedData): CalculatedResults {
  const documentNetArea = toNumber(extracted.parcel.net_alan);
  const titleDeedArea = toNumber(extracted.parcel.tapu_alani);
  const coordinates = extracted.coordinates
    .map((coordinate, index) => normalizeCoordinate(coordinate, index))
    .filter((coordinate): coordinate is CalculationCoordinate => coordinate !== null);
  const polygonArea = calculatePolygonArea(coordinates);
  const normalizedDedications = normalizeDedications(extracted.dedications);
  const { grossArea, dedicationArea, netArea: rawNetArea } = calculateNetArea(polygonArea, coordinates, normalizedDedications, extracted.warnings);
  console.log('[AREA CALC] Gross:', grossArea, 'Dedication:', dedicationArea, 'Net:', rawNetArea);

  // If net area calculated to 0, fall back to the document-extracted net_alan
  const netArea = (rawNetArea === 0 && documentNetArea !== null && documentNetArea > 0)
    ? (() => {
      console.log('[AREA CALC] netArea is 0 — falling back to extracted.parcel.net_alan:', documentNetArea);
      return documentNetArea;
    })()
    : rawNetArea;

  const effectiveNetArea = netArea ?? documentNetArea;
  const netAreaSource = polygonArea === null ? 'eimar_document' : 'röleve_coordinates';
  const areaDiscrepancy = effectiveNetArea === null
    ? null
    : round2(Math.abs(effectiveNetArea - (documentNetArea ?? 0)));
  const kaks = toNumber(extracted.zoning.kaks);
  const taksMin = toNumber(extracted.zoning.taks_min);
  const taksMax = toNumber(extracted.zoning.taks_max);
  const blockNumber = extracted.parcel.ada === null ? null : String(extracted.parcel.ada);
  const parcelNumber = extracted.parcel.parsel === null ? null : String(extracted.parcel.parsel);
  const floorCount = toNumber(extracted.zoning.kat_adedi);
  const setbacks: NumericSetbacks = {
    frontSetback: toNumber(extracted.setbacks.on_bahce),
    sideSetback: toNumber(extracted.setbacks.yan_bahce),
    rearSetback: toNumber(extracted.setbacks.arka_bahce),
  };
  const blockLines: NumericBlockLines = {
    frontLineM: toNumber(extracted.block_lines.on_cizgisi_m),
    rearLineM: toNumber(extracted.block_lines.arka_cizgisi_m),
  };
  const buildableArea = calculateBuildableAreaFromBlockLines(polygonArea, blockLines, setbacks, coordinates);
  const setbackIncrease: NumericSetbackIncrease = {
    applies: extracted.setback_increase_per_floor.applies,
    aboveFloor: toNumber(extracted.setback_increase_per_floor.above_floor),
    increasePerFloorM: toNumber(extracted.setback_increase_per_floor.increase_per_floor_m),
    affectedSetbacks: extracted.setback_increase_per_floor.affected_setbacks,
  };
  const floorSetbacks = calculateFloorSetbacks(
    setbacks,
    setbackIncrease,
    floorCount,
    buildableArea.buildableWidth,
    buildableArea.buildableDepth,
  );
  const maxInsaatAlani = multiply(kaks, effectiveNetArea);
  const projectionIncludedInKaks = normalizeProjectionIncludedInKaks(extracted.zoning.projection_included_in_kaks);
  const projectionEffect = calculateProjectionEffect(
    maxInsaatAlani,
    projectionIncludedInKaks,
    buildableArea.buildableWidth,
    floorCount,
  );

  if (polygonArea !== null && documentNetArea !== null && areaDiscrepancy !== null && areaDiscrepancy > 10) {
    const warning = buildAreaDiscrepancyWarning(areaDiscrepancy);
    if (!extracted.warnings.includes(warning)) {
      extracted.warnings.push(warning);
    }
  }

  const calculatedResults: CalculatedResults = {
    max_insaat_alani: maxInsaatAlani,
    max_taban_oturumu_min: multiply(taksMin, effectiveNetArea),
    max_taban_oturumu_max: multiply(taksMax, effectiveNetArea),
    polygon_area_calculated: grossArea,
    dedication_area: dedicationArea,
    net_area_calculated: netArea ?? effectiveNetArea,
    net_area_source: netAreaSource,
    area_discrepancy: areaDiscrepancy,
    buildable_width: buildableArea.buildableWidth,
    buildable_depth: buildableArea.buildableDepth,
    buildable_area_from_block_lines: buildableArea.buildableArea,
    buildable_area_source: buildableArea.source,
    floor_setbacks: floorSetbacks,
    setback_increase_applies: setbackIncrease.applies,
    first_affected_floor: setbackIncrease.aboveFloor,
    projection_bonus_area: projectionEffect.projection_bonus_area,
    adjusted_max_insaat_alani: projectionEffect.adjusted_max_insaat_alani,
    projection_note: projectionEffect.projection_note,
    net_alan: effectiveNetArea,
    tapu_alani: titleDeedArea,
    terk_alani: titleDeedArea === null || effectiveNetArea === null ? null : round2(titleDeedArea - effectiveNetArea),
    kat_adedi: floorCount,
    bina_yuksekligi: toNumber(extracted.zoning.bina_yuksekligi),
    insaat_nizami: extracted.zoning.insaat_nizami,
    kaks,
    taks_min: taksMin,
    taks_max: taksMax,
    on_bahce: setbacks.frontSetback,
    yan_bahce: setbacks.sideSetback,
    arka_bahce: setbacks.rearSetback,
    setback_increase: extracted.setback_increase_per_floor,
    projection_included_in_kaks: projectionIncludedInKaks,
    coordinates: extracted.coordinates,
    dedications: extracted.dedications,
    block_lines: extracted.block_lines,
    front_facade: extracted.front_facade,
    coefficient: extracted.coefficient,
    ada_parsel: blockNumber && parcelNumber ? `${blockNumber}/${parcelNumber}` : null,
  };

  console.log('[AREA CALC] Final calculated_results:', JSON.stringify(calculatedResults, null, 2));
  return calculatedResults;
}
