import { TenantDb } from '../../lib/tenantDb';
import * as companiesRepo from '../companies/companies.repo';

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  floorplanner_user_id: string | null;
  floorplanner_project_id: string | null;
  floorplanner_synced_at: Date | null;
  status_note: string | null;
  status_updated_at: Date | null;
  status_updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: ProjectRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    floorplannerUserId: row.floorplanner_user_id ?? null,
    floorplannerProjectId: row.floorplanner_project_id ?? null,
    floorplannerSyncedAt: row.floorplanner_synced_at ?? null,
    statusNote: row.status_note ?? null,
    statusUpdatedAt: row.status_updated_at ?? null,
    statusUpdatedBy: row.status_updated_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type ProjectRecord = ReturnType<typeof mapRow>;

export async function findAll(companyId: string): Promise<ProjectRecord[]> {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<ProjectRow>(
    `SELECT * FROM ${tdb.ref('projects')} ORDER BY created_at ASC`,
  );
  return rows.map(mapRow);
}

export async function findAllAcrossCompanies(): Promise<ProjectRecord[]> {
  const allCompanies = await companiesRepo.findAll();
  const results = await Promise.all(allCompanies.map((c) => findAll(c.id)));
  return results.flat();
}

export async function findByIdAcrossCompanies(id: string): Promise<ProjectRecord | null> {
  const allCompanies = await companiesRepo.findAll();
  for (const company of allCompanies) {
    const record = await findById(company.id, id);
    if (record) return record;
  }
  return null;
}

export async function findById(companyId: string, id: string): Promise<ProjectRecord | null> {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<ProjectRow>(
    `SELECT * FROM ${tdb.ref('projects')} WHERE id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function create(
  companyId: string,
  data: { name: string; description?: string; status?: string },
): Promise<ProjectRecord> {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<ProjectRow>(
    `INSERT INTO ${tdb.ref('projects')} (name, description, status)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [data.name, data.description ?? null, data.status ?? 'active'],
  );
  return mapRow(rows[0]!);
}

export async function update(
  companyId: string,
  id: string,
  data: { name?: string; description?: string; status?: string },
): Promise<ProjectRecord | null> {
  const tdb = new TenantDb(companyId);
  const setClauses: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];

  if (data.name !== undefined) { params.push(data.name); setClauses.push(`name = $${params.length}`); }
  if (data.description !== undefined) { params.push(data.description); setClauses.push(`description = $${params.length}`); }
  if (data.status !== undefined) { params.push(data.status); setClauses.push(`status = $${params.length}`); }

  params.push(id);
  const { rows } = await tdb.query<ProjectRow>(
    `UPDATE ${tdb.ref('projects')} SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params,
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function updateStatus(
  companyId: string,
  id: string,
  data: { status: 'active' | 'approved' | 'lost'; note?: string; userId: string },
): Promise<ProjectRecord | null> {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<ProjectRow>(
    `UPDATE ${tdb.ref('projects')}
     SET status = $1,
         status_note = $2,
         status_updated_at = NOW(),
         status_updated_by = $3,
         updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [data.status, data.note ?? null, data.userId, id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function updateFloorplannerUserId(
  companyId: string,
  id: string,
  floorplannerUserId: string,
): Promise<ProjectRecord | null> {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<ProjectRow>(
    `UPDATE ${tdb.ref('projects')}
     SET floorplanner_user_id = $1, floorplanner_synced_at = NOW(), updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [floorplannerUserId, id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function updateFloorplannerProjectId(
  companyId: string,
  id: string,
  floorplannerProjectId: string,
): Promise<ProjectRecord | null> {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<ProjectRow>(
    `UPDATE ${tdb.ref('projects')}
     SET floorplanner_project_id = $1, floorplanner_synced_at = NOW(), updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [floorplannerProjectId, id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function deleteById(companyId: string, id: string): Promise<boolean> {
  const tdb = new TenantDb(companyId);
  const { rowCount } = await tdb.query(
    `DELETE FROM ${tdb.ref('projects')} WHERE id = $1`,
    [id],
  );
  return rowCount > 0;
}
