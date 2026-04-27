import { TenantDb } from '../../lib/tenantDb';
import * as companiesRepo from '../companies/companies.repo';

interface TenderRow {
  id: string;
  project_id: string;
  project_name: string | null;
  category_id: string | null;
  category_name: string | null;
  title: string;
  description: string | null;
  status: string;
  deadline: Date | null;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: TenderRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    categoryId: row.category_id,
    categoryName: row.category_name,
    title: row.title,
    description: row.description,
    status: row.status,
    deadline: row.deadline,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type TenderRecord = ReturnType<typeof mapRow>;

interface FindAllOptions {
  limit?: number;
  sortOrder?: 'asc' | 'desc';
}

export async function findAll(companyId: string, options: FindAllOptions = {}): Promise<TenderRecord[]> {
  const tdb = new TenantDb(companyId);
  const t = tdb.ref('tenders');
  const p = tdb.ref('projects');
  const sortOrder = options.sortOrder === 'desc' ? 'DESC' : 'ASC';
  const params: unknown[] = [companyId];
  const limitClause = options.limit ? ` LIMIT $${params.length + 1}` : '';
  if (options.limit) params.push(options.limit);
  const { rows } = await tdb.query<TenderRow>(
    `SELECT t.*, p.name AS project_name, c.name AS category_name
     FROM ${t} t
     LEFT JOIN ${p} p ON t.project_id = p.id
     LEFT JOIN public.categories c ON t.category_id = c.id AND c.company_id = $1
     ORDER BY t.created_at ${sortOrder}${limitClause}`,
    params,
  );
  return rows.map(mapRow);
}

export async function findAllAcrossCompanies(options: FindAllOptions = {}): Promise<TenderRecord[]> {
  const allCompanies = await companiesRepo.findAll();
  const results = await Promise.all(allCompanies.map((c) => findAll(c.id, options)));
  const sortFactor = options.sortOrder === 'desc' ? -1 : 1;
  const records = results.flat().sort((a, b) => {
    const aTime = a.createdAt.getTime();
    const bTime = b.createdAt.getTime();
    return (aTime - bTime) * sortFactor;
  });
  return options.limit ? records.slice(0, options.limit) : records;
}

export async function findByIdAcrossCompanies(id: string): Promise<TenderRecord | null> {
  const allCompanies = await companiesRepo.findAll();
  for (const company of allCompanies) {
    const record = await findById(company.id, id);
    if (record) return record;
  }
  return null;
}

export async function resolveCompanyIdForTender(tenderId: string): Promise<string | null> {
  const allCompanies = await companiesRepo.findAll();
  for (const company of allCompanies) {
    const tdb = new TenantDb(company.id);
    const { rows } = await tdb.query<{ id: string }>(
      `SELECT id FROM ${tdb.ref('tenders')} WHERE id = $1 LIMIT 1`,
      [tenderId],
    );
    if (rows.length > 0) return company.id;
  }
  return null;
}

export async function findById(companyId: string, id: string): Promise<TenderRecord | null> {
  const tdb = new TenantDb(companyId);
  const t = tdb.ref('tenders');
  const p = tdb.ref('projects');
  const { rows } = await tdb.query<TenderRow>(
    `SELECT t.*, p.name AS project_name, c.name AS category_name
     FROM ${t} t
     LEFT JOIN ${p} p ON t.project_id = p.id
     LEFT JOIN public.categories c ON t.category_id = c.id AND c.company_id = $1
     WHERE t.id = $2
     LIMIT 1`,
    [companyId, id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function create(
  companyId: string,
  data: {
    projectId: string;
    categoryId?: string | null;
    title: string;
    description?: string;
    status?: string;
    deadline?: Date;
  },
): Promise<TenderRecord> {
  const tdb = new TenantDb(companyId);
  const { rows } = await tdb.query<TenderRow>(
    `INSERT INTO ${tdb.ref('tenders')} (project_id, category_id, title, description, status, deadline)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *, NULL::text AS project_name, NULL::text AS category_name`,
    [
      data.projectId,
      data.categoryId ?? null,
      data.title,
      data.description ?? null,
      data.status ?? 'draft',
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
    categoryId?: string | null;
    title?: string;
    description?: string;
    status?: string;
    deadline?: Date | null;
  },
): Promise<TenderRecord | null> {
  const tdb = new TenantDb(companyId);
  const setClauses: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];

  if (data.projectId !== undefined) { params.push(data.projectId); setClauses.push(`project_id = $${params.length}`); }
  if (data.categoryId !== undefined) { params.push(data.categoryId); setClauses.push(`category_id = $${params.length}`); }
  if (data.title !== undefined) { params.push(data.title); setClauses.push(`title = $${params.length}`); }
  if (data.description !== undefined) { params.push(data.description); setClauses.push(`description = $${params.length}`); }
  if (data.status !== undefined) { params.push(data.status); setClauses.push(`status = $${params.length}`); }
  if (data.deadline !== undefined) { params.push(data.deadline); setClauses.push(`deadline = $${params.length}`); }

  params.push(id);
  const { rows } = await tdb.query<TenderRow>(
    `UPDATE ${tdb.ref('tenders')} SET ${setClauses.join(', ')} WHERE id = $${params.length}
     RETURNING *, NULL::text AS project_name, NULL::text AS category_name`,
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
