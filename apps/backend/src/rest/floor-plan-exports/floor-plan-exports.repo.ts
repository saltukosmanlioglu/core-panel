import { TenantDb } from '../../lib/tenantDb';
import type { FloorPlanExport } from '@core-panel/shared';

interface FloorPlanExportRow {
  id: string;
  project_id: string;
  floorplanner_export_id: string | null;
  image_url: string;
  created_at: Date;
}

function mapRow(row: FloorPlanExportRow): FloorPlanExport {
  return {
    id: row.id,
    projectId: row.project_id,
    floorplannerExportId: row.floorplanner_export_id,
    imageUrl: row.image_url,
    createdAt: row.created_at.toISOString(),
  };
}

export async function upsert(
  tdb: TenantDb,
  data: {
    projectId: string;
    floorplannerExportId: string;
    imageUrl: string;
  },
): Promise<FloorPlanExport | null> {
  const { rows } = await tdb.query<FloorPlanExportRow>(
    `INSERT INTO ${tdb.ref('floor_plan_exports')}
       (project_id, floorplanner_export_id, image_url)
     VALUES ($1, $2, $3)
     ON CONFLICT (project_id, floorplanner_export_id) DO NOTHING
     RETURNING *`,
    [data.projectId, data.floorplannerExportId, data.imageUrl],
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
