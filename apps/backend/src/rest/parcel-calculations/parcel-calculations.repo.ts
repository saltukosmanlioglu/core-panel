import { TenantDb } from '../../lib/tenantDb';
import type { Edge, Overhang, Point } from './parcel-calculations.service';

export type ParcelDocumentExtracted = Record<string, string | number | null>;

export interface ParcelCalculation {
  id: string;
  projectId: string;
  name: string;
  edges: Edge[];
  parcelArea: number;
  parcelVertices: Point[];
  setbackSource: 'manual' | 'document';
  setbackFront: number;
  setbackBack: number;
  setbackLeft: number;
  setbackRight: number;
  setbackDocumentPath: string | null;
  setbackDocumentName: string | null;
  setbackRawText: string | null;
  planNotlariFileUrl: string | null;
  planNotlariExtracted: ParcelDocumentExtracted | null;
  imarDurumuFileUrl: string | null;
  imarDurumuExtracted: ParcelDocumentExtracted | null;
  footprintArea: number;
  footprintVertices: Point[];
  floorCount: number;
  overhangs: Overhang[];
  totalConstructionArea: number;
  status: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ParcelCalculationRow {
  id: string;
  project_id: string;
  name: string | null;
  edges: unknown;
  parcel_area: string | number | null;
  parcel_vertices: unknown;
  setback_source: string | null;
  setback_front: string | number | null;
  setback_back: string | number | null;
  setback_left: string | number | null;
  setback_right: string | number | null;
  setback_document_path: string | null;
  setback_document_name: string | null;
  setback_raw_text: string | null;
  plan_notlari_file_url: string | null;
  plan_notlari_extracted: unknown;
  imar_durumu_file_url: string | null;
  imar_durumu_extracted: unknown;
  footprint_area: string | number | null;
  footprint_vertices: unknown;
  floor_count: number | null;
  overhangs: unknown;
  total_construction_area: string | number | null;
  status: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ParcelCalculationInput {
  name?: string | null;
  edges?: Edge[];
  parcelArea?: number;
  parcelVertices?: Point[];
  setbackSource?: 'manual' | 'document';
  setbackFront?: number;
  setbackBack?: number;
  setbackLeft?: number;
  setbackRight?: number;
  setbackDocumentPath?: string | null;
  setbackDocumentName?: string | null;
  setbackRawText?: string | null;
  planNotlariFileUrl?: string | null;
  planNotlariExtracted?: ParcelDocumentExtracted | null;
  imarDurumuFileUrl?: string | null;
  imarDurumuExtracted?: ParcelDocumentExtracted | null;
  footprintArea?: number;
  footprintVertices?: Point[];
  floorCount?: number;
  overhangs?: Overhang[];
  totalConstructionArea?: number;
  status?: string;
  createdBy?: string | null;
}

const UPDATE_COLUMNS = [
  ['name', 'name', false],
  ['edges', 'edges', true],
  ['parcelArea', 'parcel_area', false],
  ['parcelVertices', 'parcel_vertices', true],
  ['setbackSource', 'setback_source', false],
  ['setbackFront', 'setback_front', false],
  ['setbackBack', 'setback_back', false],
  ['setbackLeft', 'setback_left', false],
  ['setbackRight', 'setback_right', false],
  ['setbackDocumentPath', 'setback_document_path', false],
  ['setbackDocumentName', 'setback_document_name', false],
  ['setbackRawText', 'setback_raw_text', false],
  ['planNotlariFileUrl', 'plan_notlari_file_url', false],
  ['planNotlariExtracted', 'plan_notlari_extracted', 'nullableJson'],
  ['imarDurumuFileUrl', 'imar_durumu_file_url', false],
  ['imarDurumuExtracted', 'imar_durumu_extracted', 'nullableJson'],
  ['footprintArea', 'footprint_area', false],
  ['footprintVertices', 'footprint_vertices', true],
  ['floorCount', 'floor_count', false],
  ['overhangs', 'overhangs', true],
  ['totalConstructionArea', 'total_construction_area', false],
  ['status', 'status', false],
  ['createdBy', 'created_by', false],
] as const satisfies ReadonlyArray<readonly [keyof ParcelCalculationInput, string, boolean | 'nullableJson']>;

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function asDocumentExtracted(value: unknown): ParcelDocumentExtracted | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as ParcelDocumentExtracted
    : null;
}

function mapRow(row: ParcelCalculationRow): ParcelCalculation {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name ?? 'Hesaplama',
    edges: asArray<Edge>(row.edges),
    parcelArea: toNumber(row.parcel_area),
    parcelVertices: asArray<Point>(row.parcel_vertices),
    setbackSource: row.setback_source === 'document' ? 'document' : 'manual',
    setbackFront: toNumber(row.setback_front),
    setbackBack: toNumber(row.setback_back),
    setbackLeft: toNumber(row.setback_left),
    setbackRight: toNumber(row.setback_right),
    setbackDocumentPath: row.setback_document_path,
    setbackDocumentName: row.setback_document_name,
    setbackRawText: row.setback_raw_text,
    planNotlariFileUrl: row.plan_notlari_file_url,
    planNotlariExtracted: asDocumentExtracted(row.plan_notlari_extracted),
    imarDurumuFileUrl: row.imar_durumu_file_url,
    imarDurumuExtracted: asDocumentExtracted(row.imar_durumu_extracted),
    footprintArea: toNumber(row.footprint_area),
    footprintVertices: asArray<Point>(row.footprint_vertices),
    floorCount: row.floor_count ?? 4,
    overhangs: asArray<Overhang>(row.overhangs),
    totalConstructionArea: toNumber(row.total_construction_area),
    status: row.status ?? 'draft',
    createdBy: row.created_by,
    createdAt: toDateString(row.created_at),
    updatedAt: toDateString(row.updated_at),
  };
}

function definedEntries(data: ParcelCalculationInput): Array<[string, unknown, boolean]> {
  return UPDATE_COLUMNS
    .filter(([key]) => data[key] !== undefined)
    .map(([key, column, jsonMode]) => {
      const value = data[key];
      const isJson = jsonMode !== false;
      const normalizedValue = jsonMode === true
        ? JSON.stringify(value ?? [])
        : jsonMode === 'nullableJson' && value !== null && value !== undefined
          ? JSON.stringify(value)
          : value;
      return [column, normalizedValue, isJson];
    });
}

export async function create(
  companyId: string,
  projectId: string,
  data: ParcelCalculationInput,
): Promise<ParcelCalculation> {
  const tdb = new TenantDb(companyId);
  const entries = definedEntries(data);
  const columns = ['project_id', ...entries.map(([column]) => column)];
  const values = [projectId, ...entries.map(([, value]) => value)];
  const placeholders = values.map((_, index) => {
    const entry = entries[index - 1];
    return entry?.[2] ? `$${index + 1}::jsonb` : `$${index + 1}`;
  });

  const { rows } = await tdb.query<ParcelCalculationRow>(
    `INSERT INTO ${tdb.ref('parcel_calculations')} (${columns.join(', ')})
     VALUES (${placeholders.join(', ')})
     RETURNING *`,
    values,
  );

  return mapRow(rows[0]!);
}

export async function findByProjectId(companyId: string, projectId: string): Promise<ParcelCalculation[]> {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<ParcelCalculationRow>(
    `SELECT * FROM ${tdb.ref('parcel_calculations')}
     WHERE project_id = $1
     ORDER BY created_at DESC`,
    [projectId],
  );

  return rows.map(mapRow);
}

export async function findById(companyId: string, id: string): Promise<ParcelCalculation | null> {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<ParcelCalculationRow>(
    `SELECT * FROM ${tdb.ref('parcel_calculations')} WHERE id = $1 LIMIT 1`,
    [id],
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

export async function update(
  companyId: string,
  id: string,
  data: ParcelCalculationInput,
): Promise<ParcelCalculation | null> {
  const entries = definedEntries(data);
  if (entries.length === 0) return findById(companyId, id);

  const tdb = new TenantDb(companyId);
  const params = entries.map(([, value]) => value);
  const setClauses = entries.map(([column, , isJson], index) => (
    `${column} = $${index + 1}${isJson ? '::jsonb' : ''}`
  ));
  params.push(id);

  const { rows } = await tdb.query<ParcelCalculationRow>(
    `UPDATE ${tdb.ref('parcel_calculations')}
     SET ${setClauses.join(', ')}, updated_at = NOW()
     WHERE id = $${params.length}
     RETURNING *`,
    params,
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

export async function deleteById(companyId: string, id: string): Promise<boolean> {
  const tdb = new TenantDb(companyId);
  const { rowCount } = await tdb.query(
    `DELETE FROM ${tdb.ref('parcel_calculations')} WHERE id = $1`,
    [id],
  );

  return rowCount > 0;
}
