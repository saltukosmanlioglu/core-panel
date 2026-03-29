import { TenantDb } from '../../lib/tenantDb';
import * as companiesRepo from '../companies/companies.repo';

interface TenderRow {
  id: string;
  project_id: string;
  project_name: string | null;
  title: string;
  description: string | null;
  status: string;
  budget: string | null;
  deadline: Date | null;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: TenderRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    title: row.title,
    description: row.description,
    status: row.status,
    budget: row.budget,
    deadline: row.deadline,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type TenderRecord = ReturnType<typeof mapRow>;

export async function findAll(companyId: string): Promise<TenderRecord[]> {
  const tdb = new TenantDb(companyId);
  const t = tdb.ref('tenders');
  const p = tdb.ref('projects');
  const { rows } = await tdb.query<TenderRow>(
    `SELECT t.*, p.name AS project_name
     FROM ${t} t
     LEFT JOIN ${p} p ON t.project_id = p.id
     ORDER BY t.created_at ASC`,
  );
  return rows.map(mapRow);
}

export async function findAllAcrossCompanies(): Promise<TenderRecord[]> {
  const allCompanies = await companiesRepo.findAll();
  const results = await Promise.all(allCompanies.map((c) => findAll(c.id)));
  return results.flat();
}

export async function findById(companyId: string, id: string): Promise<TenderRecord | null> {
  const tdb = new TenantDb(companyId);
  const t = tdb.ref('tenders');
  const p = tdb.ref('projects');
  const { rows } = await tdb.query<TenderRow>(
    `SELECT t.*, p.name AS project_name
     FROM ${t} t
     LEFT JOIN ${p} p ON t.project_id = p.id
     WHERE t.id = $1
     LIMIT 1`,
    [id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function create(
  companyId: string,
  data: {
    projectId: string;
    title: string;
    description?: string;
    status?: string;
    budget?: string;
    deadline?: Date;
  },
): Promise<TenderRecord> {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<TenderRow>(
    `INSERT INTO ${tdb.ref('tenders')} (project_id, title, description, status, budget, deadline)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *, NULL::text AS project_name`,
    [
      data.projectId,
      data.title,
      data.description ?? null,
      data.status ?? 'draft',
      data.budget ?? null,
      data.deadline ?? null,
    ],
  );
  return mapRow(rows[0]!);
}

export async function update(
  companyId: string,
  id: string,
  data: {
    projectId?: string;
    title?: string;
    description?: string;
    status?: string;
    budget?: string;
    deadline?: Date | null;
  },
): Promise<TenderRecord | null> {
  const tdb = new TenantDb(companyId);
  const setClauses: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];

  if (data.projectId !== undefined) { params.push(data.projectId); setClauses.push(`project_id = $${params.length}`); }
  if (data.title !== undefined) { params.push(data.title); setClauses.push(`title = $${params.length}`); }
  if (data.description !== undefined) { params.push(data.description); setClauses.push(`description = $${params.length}`); }
  if (data.status !== undefined) { params.push(data.status); setClauses.push(`status = $${params.length}`); }
  if (data.budget !== undefined) { params.push(data.budget); setClauses.push(`budget = $${params.length}`); }
  if (data.deadline !== undefined) { params.push(data.deadline); setClauses.push(`deadline = $${params.length}`); }

  params.push(id);
  const { rows } = await tdb.query<TenderRow>(
    `UPDATE ${tdb.ref('tenders')} SET ${setClauses.join(', ')} WHERE id = $${params.length}
     RETURNING *, NULL::text AS project_name`,
    params,
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function deleteById(companyId: string, id: string): Promise<boolean> {
  const tdb = new TenantDb(companyId);
  const { rowCount } = await tdb.query(
    `DELETE FROM ${tdb.ref('tenders')} WHERE id = $1`,
    [id],
  );
  return rowCount > 0;
}
