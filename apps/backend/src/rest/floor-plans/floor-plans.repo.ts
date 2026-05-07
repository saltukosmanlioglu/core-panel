import { TenantDb } from '../../lib/tenantDb';

export interface FloorPlanRow {
  id: string;
  project_id: string;
  name: string;
  floor_number: number | null;
  sh3do_user_id: string | null;
  sh3do_home_name: string | null;
  apartment_count: number | null;
  room_type: string | null;
  total_area: string | null;
  ai_prompt: string | null;
  ai_generated_xml: string | null;
  plan_json: unknown;
  thumbnail_url: string | null;
  status: string;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface FloorPlan {
  id: string;
  projectId: string;
  name: string;
  floorNumber: number | null;
  sh3doUserId: string | null;
  sh3doHomeName: string | null;
  apartmentCount: number | null;
  roomType: string | null;
  totalArea: number | null;
  aiPrompt: string | null;
  aiGeneratedXml: string | null;
  thumbnailUrl: string | null;
  status: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFloorPlanInput {
  projectId: string;
  name?: string;
  floorNumber?: number;
  sh3doUserId?: string;
  sh3doHomeName?: string;
  apartmentCount?: number;
  roomType?: string;
  totalArea?: number;
  aiPrompt?: string;
  aiGeneratedXml?: string;
  status?: string;
  createdBy?: string;
}

export interface UpdateFloorPlanInput {
  name?: string;
  floorNumber?: number;
  sh3doUserId?: string;
  sh3doHomeName?: string;
  apartmentCount?: number;
  roomType?: string;
  totalArea?: number;
  aiGeneratedXml?: string;
  status?: string;
}

function mapRow(row: FloorPlanRow): FloorPlan {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    floorNumber: row.floor_number,
    sh3doUserId: row.sh3do_user_id,
    sh3doHomeName: row.sh3do_home_name,
    apartmentCount: row.apartment_count,
    roomType: row.room_type,
    totalArea: row.total_area != null ? parseFloat(row.total_area) : null,
    aiPrompt: row.ai_prompt,
    aiGeneratedXml: row.ai_generated_xml,
    thumbnailUrl: row.thumbnail_url,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function createFloorPlan(tdb: TenantDb, data: CreateFloorPlanInput): Promise<FloorPlan> {
  const { rows } = await tdb.query<FloorPlanRow>(
    `INSERT INTO ${tdb.ref('floor_plans')}
       (project_id, name, floor_number, sh3do_user_id, sh3do_home_name,
        apartment_count, room_type, total_area, ai_prompt, ai_generated_xml,
        status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      data.projectId,
      data.name ?? 'Kat Planı',
      data.floorNumber ?? 1,
      data.sh3doUserId ?? null,
      data.sh3doHomeName ?? null,
      data.apartmentCount ?? null,
      data.roomType ?? null,
      data.totalArea ?? null,
      data.aiPrompt ?? null,
      data.aiGeneratedXml ?? null,
      data.status ?? 'draft',
      data.createdBy ?? null,
    ],
  );
  return mapRow(rows[0]);
}

export async function findByProjectId(tdb: TenantDb, projectId: string): Promise<FloorPlan[]> {
  const { rows } = await tdb.query<FloorPlanRow>(
    `SELECT * FROM ${tdb.ref('floor_plans')} WHERE project_id = $1 ORDER BY created_at DESC`,
    [projectId],
  );
  return rows.map(mapRow);
}

export async function findById(tdb: TenantDb, id: string): Promise<FloorPlan | null> {
  const { rows } = await tdb.query<FloorPlanRow>(
    `SELECT * FROM ${tdb.ref('floor_plans')} WHERE id = $1`,
    [id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function updateFloorPlan(tdb: TenantDb, id: string, data: UpdateFloorPlanInput): Promise<FloorPlan | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (data.name !== undefined) { sets.push(`name = $${i++}`); params.push(data.name); }
  if (data.floorNumber !== undefined) { sets.push(`floor_number = $${i++}`); params.push(data.floorNumber); }
  if (data.sh3doUserId !== undefined) { sets.push(`sh3do_user_id = $${i++}`); params.push(data.sh3doUserId); }
  if (data.sh3doHomeName !== undefined) { sets.push(`sh3do_home_name = $${i++}`); params.push(data.sh3doHomeName); }
  if (data.apartmentCount !== undefined) { sets.push(`apartment_count = $${i++}`); params.push(data.apartmentCount); }
  if (data.roomType !== undefined) { sets.push(`room_type = $${i++}`); params.push(data.roomType); }
  if (data.totalArea !== undefined) { sets.push(`total_area = $${i++}`); params.push(data.totalArea); }
  if (data.aiGeneratedXml !== undefined) { sets.push(`ai_generated_xml = $${i++}`); params.push(data.aiGeneratedXml); }
  if (data.status !== undefined) { sets.push(`status = $${i++}`); params.push(data.status); }

  if (sets.length === 0) return findById(tdb, id);

  sets.push(`updated_at = NOW()`);
  params.push(id);

  const { rows } = await tdb.query<FloorPlanRow>(
    `UPDATE ${tdb.ref('floor_plans')} SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    params,
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function deleteFloorPlan(tdb: TenantDb, id: string): Promise<boolean> {
  const { rowCount } = await tdb.query(
    `DELETE FROM ${tdb.ref('floor_plans')} WHERE id = $1`,
    [id],
  );
  return rowCount > 0;
}
