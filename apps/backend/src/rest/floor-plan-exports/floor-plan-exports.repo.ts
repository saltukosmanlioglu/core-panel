import { TenantDb } from '../../lib/tenantDb';
import type { FloorPlanExport, FloorPlanMetadata } from '@core-panel/shared';

interface FloorPlanExportRow {
  id: string;
  project_id: string;
  floorplanner_export_id: string | null;
  image_url: string | null;
  fml_data: unknown | null;
  plan_metadata: unknown | null;
  created_at: Date;
}

function mapRow(row: FloorPlanExportRow): FloorPlanExport {
  return {
    id: row.id,
    projectId: row.project_id,
    floorplannerExportId: row.floorplanner_export_id,
    imageUrl: row.image_url ?? '',
    fmlData: row.fml_data,
    planMetadata: row.plan_metadata as FloorPlanMetadata | null,
    createdAt: row.created_at.toISOString(),
  };
}

export async function upsert(
  tdb: TenantDb,
  data: {
    projectId: string;
    floorplannerExportId: string;
    imageUrl: string;
    fmlData?: unknown | null;
    planMetadata?: FloorPlanMetadata | null;
  },
): Promise<FloorPlanExport | null> {
  const { rows } = await tdb.query<FloorPlanExportRow>(
    `INSERT INTO ${tdb.ref('floor_plan_exports')} AS current_exports
       (project_id, floorplanner_export_id, image_url, fml_data, plan_metadata)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
     ON CONFLICT (project_id, floorplanner_export_id)
     DO UPDATE SET
       image_url = EXCLUDED.image_url,
       fml_data = COALESCE(EXCLUDED.fml_data, current_exports.fml_data),
       plan_metadata = COALESCE(EXCLUDED.plan_metadata, current_exports.plan_metadata),
       updated_at = NOW()
     RETURNING *`,
    [
      data.projectId,
      data.floorplannerExportId,
      data.imageUrl,
      data.fmlData === undefined ? null : JSON.stringify(data.fmlData),
      data.planMetadata === undefined ? null : JSON.stringify(data.planMetadata),
    ],
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

export async function findByProjectId(tdb: TenantDb, projectId: string): Promise<FloorPlanExport[]> {
  const { rows } = await tdb.query<FloorPlanExportRow>(
    `SELECT * FROM ${tdb.ref('floor_plan_exports')}
     WHERE project_id = $1
     ORDER BY created_at DESC`,
    [projectId],
  );

  return rows.map(mapRow);
}

export async function findLatestByProjectId(tdb: TenantDb, projectId: string): Promise<FloorPlanExport | null> {
  const { rows } = await tdb.query<FloorPlanExportRow>(
    `SELECT * FROM ${tdb.ref('floor_plan_exports')}
     WHERE project_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [projectId],
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

export async function findById(tdb: TenantDb, id: string): Promise<FloorPlanExport | null> {
  const { rows } = await tdb.query<FloorPlanExportRow>(
    `SELECT * FROM ${tdb.ref('floor_plan_exports')} WHERE id = $1 LIMIT 1`,
    [id],
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

export async function remove(tdb: TenantDb, id: string): Promise<FloorPlanExport | null> {
  const { rows } = await tdb.query<FloorPlanExportRow>(
    `DELETE FROM ${tdb.ref('floor_plan_exports')} WHERE id = $1 RETURNING *`,
    [id],
  );

  return rows[0] ? mapRow(rows[0]) : null;
}
