import { TenantDb } from '../../lib/tenantDb';
import type { FloorType, MetrajTakeoff, RoughConstruction } from '@core-panel/shared';

interface MetrajTakeoffRow {
  id: string;
  project_id: string;
  name: string;
  parcel_calculation_id: string | null;
  floor_types: unknown;
  rough_construction: unknown;
  status: string;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: MetrajTakeoffRow): MetrajTakeoff {
  const roughConstruction = row.rough_construction && typeof row.rough_construction === 'object' && !Array.isArray(row.rough_construction)
    && Array.isArray((row.rough_construction as { floorTypes?: unknown }).floorTypes)
    ? row.rough_construction as RoughConstruction
    : null;

  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    parcelCalculationId: row.parcel_calculation_id,
    floorTypes: Array.isArray(row.floor_types) ? (row.floor_types as FloorType[]) : [],
    roughConstruction,
    status: row.status,
    createdAt: (row.created_at instanceof Date ? row.created_at : new Date(row.created_at)).toISOString(),
    updatedAt: (row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at)).toISOString(),
  };
}

export async function findByProjectId(companyId: string, projectId: string): Promise<MetrajTakeoff | null> {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<MetrajTakeoffRow>(
    `SELECT * FROM ${tdb.ref('metraj_takeoffs')} WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [projectId],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function findById(companyId: string, id: string): Promise<MetrajTakeoff | null> {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<MetrajTakeoffRow>(
    `SELECT * FROM ${tdb.ref('metraj_takeoffs')} WHERE id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export interface TakeoffUpsertInput {
  name?: string;
  parcelCalculationId?: string | null;
  floorTypes: FloorType[];
  roughConstruction?: RoughConstruction | null;
  createdBy?: string | null;
}

export async function upsert(
  companyId: string,
  projectId: string,
  data: TakeoffUpsertInput,
): Promise<MetrajTakeoff> {
  const tdb = new TenantDb(companyId);
  const existing = await findByProjectId(companyId, projectId);

  if (existing) {
    const { rows } = await tdb.query<MetrajTakeoffRow>(
      `UPDATE ${tdb.ref('metraj_takeoffs')}
       SET name = $1,
           parcel_calculation_id = $2,
           floor_types = $3::jsonb,
           rough_construction = $4::jsonb,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [
        data.name ?? existing.name,
        data.parcelCalculationId !== undefined ? data.parcelCalculationId : existing.parcelCalculationId,
        JSON.stringify(data.floorTypes),
        JSON.stringify(data.roughConstruction !== undefined ? data.roughConstruction : existing.roughConstruction ?? {}),
        existing.id,
      ],
    );
    return mapRow(rows[0]!);
  }

  const { rows } = await tdb.query<MetrajTakeoffRow>(
    `INSERT INTO ${tdb.ref('metraj_takeoffs')} (project_id, name, parcel_calculation_id, floor_types, rough_construction, created_by)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)
     RETURNING *`,
    [
      projectId,
      data.name ?? 'Metraj',
      data.parcelCalculationId ?? null,
      JSON.stringify(data.floorTypes),
      JSON.stringify(data.roughConstruction ?? {}),
      data.createdBy ?? null,
    ],
  );
  return mapRow(rows[0]!);
}

export async function deleteById(companyId: string, id: string): Promise<boolean> {
  const tdb = new TenantDb(companyId);
  const { rowCount } = await tdb.query(
    `DELETE FROM ${tdb.ref('metraj_takeoffs')} WHERE id = $1`,
    [id],
  );
  return rowCount > 0;
}
