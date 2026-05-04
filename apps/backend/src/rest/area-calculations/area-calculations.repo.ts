import { TenantDb } from '../../lib/tenantDb';
import type { AreaCalculation, CalculatedResults, ExtractedData } from './area-calculations.types';

interface AreaCalculationRow {
  id: string;
  project_id: string;
  status: string;
  rolovesi_path: string | null;
  eimar_path: string | null;
  plan_notes_path: string | null;
  other_files: unknown;
  extracted_data: unknown;
  calculated_results: unknown;
  warnings: unknown;
  note: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAreaCalculationInput {
  projectId: string;
  status: string;
  rolovesiPath?: string | null;
  eimarPath?: string | null;
  planNotesPath?: string | null;
  otherFiles?: string[];
  note?: string | null;
  createdBy?: string | null;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function mapRow(row: AreaCalculationRow): AreaCalculation {
  return {
    id: row.id,
    projectId: row.project_id,
    status: row.status,
    rolovesiPath: row.rolovesi_path,
    eimarPath: row.eimar_path,
    planNotesPath: row.plan_notes_path,
    otherFiles: toStringArray(row.other_files),
    extractedData: row.extracted_data as ExtractedData | null,
    calculatedResults: row.calculated_results as CalculatedResults | null,
    warnings: toStringArray(row.warnings),
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function createProcessing(
  tdb: TenantDb,
  data: CreateAreaCalculationInput,
): Promise<AreaCalculation> {
  const { rows } = await tdb.query<AreaCalculationRow>(
    `INSERT INTO ${tdb.ref('area_calculations')}
       (project_id, status, rolovesi_path, eimar_path, plan_notes_path, other_files, note, created_by)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
     RETURNING *`,
    [
      data.projectId,
      data.status,
      data.rolovesiPath ?? null,
      data.eimarPath ?? null,
      data.planNotesPath ?? null,
      JSON.stringify(data.otherFiles ?? []),
      data.note ?? null,
      data.createdBy ?? null,
    ],
  );

  return mapRow(rows[0]!);
}

export async function markCompleted(
  tdb: TenantDb,
  id: string,
  extractedData: ExtractedData,
  calculatedResults: CalculatedResults,
  warnings: string[],
): Promise<AreaCalculation | null> {
  const { rows } = await tdb.query<AreaCalculationRow>(
    `UPDATE ${tdb.ref('area_calculations')}
     SET status = 'completed',
         extracted_data = $1::jsonb,
         calculated_results = $2::jsonb,
         warnings = $3::jsonb,
         updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [JSON.stringify(extractedData), JSON.stringify(calculatedResults), JSON.stringify(warnings), id],
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

export async function markFailed(tdb: TenantDb, id: string, warning: string): Promise<AreaCalculation | null> {
  const { rows } = await tdb.query<AreaCalculationRow>(
    `UPDATE ${tdb.ref('area_calculations')}
     SET status = 'failed',
         warnings = $1::jsonb,
         updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [JSON.stringify([warning]), id],
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

export async function findByProjectId(tdb: TenantDb, projectId: string): Promise<AreaCalculation[]> {
  const { rows } = await tdb.query<AreaCalculationRow>(
    `SELECT * FROM ${tdb.ref('area_calculations')}
     WHERE project_id = $1
     ORDER BY created_at DESC`,
    [projectId],
  );

  return rows.map(mapRow);
}

export async function findById(tdb: TenantDb, id: string): Promise<AreaCalculation | null> {
  const { rows } = await tdb.query<AreaCalculationRow>(
    `SELECT * FROM ${tdb.ref('area_calculations')} WHERE id = $1 LIMIT 1`,
    [id],
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

export async function findLatest(tdb: TenantDb, projectId: string): Promise<AreaCalculation | null> {
  const { rows } = await tdb.query<AreaCalculationRow>(
    `SELECT * FROM ${tdb.ref('area_calculations')}
     WHERE project_id = $1 AND status = 'completed'
     ORDER BY created_at DESC
     LIMIT 1`,
    [projectId],
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

export async function remove(tdb: TenantDb, id: string): Promise<AreaCalculation | null> {
  const calculation = await findById(tdb, id);
  if (!calculation) return null;

  await tdb.query(`DELETE FROM ${tdb.ref('area_calculations')} WHERE id = $1`, [id]);
  return calculation;
}
