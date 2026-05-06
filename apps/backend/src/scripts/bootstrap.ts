import 'dotenv/config';
import bcrypt from 'bcrypt';
import { pool } from '../db/connection';
import { createTenantSchema } from '../services/schemaService';

const COMPANY_NAME = 'Mila İnşaat Dekorasyon Proje San. Tic. Ltd. Şti.';
const ADMIN_EMAIL = 'admin@milainsaat.com';
const ADMIN_PASSWORD = 'Bayburt1.';
const ADMIN_ROLE = 'company_admin';

async function ensureCompany(): Promise<{ id: string; created: boolean }> {
  const existing = await pool.query<{ id: string }>(
    'SELECT id FROM companies WHERE name = $1 LIMIT 1',
    [COMPANY_NAME],
  );

  if (existing.rows[0]) {
    console.log(`Company already exists id=${existing.rows[0].id}`);
    return { id: existing.rows[0].id, created: false };
  }

  const created = await pool.query<{ id: string }>(
    `INSERT INTO companies (name)
     VALUES ($1)
     RETURNING id`,
    [COMPANY_NAME],
  );

  console.log(`Company created id=${created.rows[0]!.id}`);
  return { id: created.rows[0]!.id, created: true };
}

async function ensureUser(companyId: string): Promise<{ id: string; created: boolean }> {
  const existing = await pool.query<{ id: string }>(
    'SELECT id FROM users WHERE email = $1 LIMIT 1',
    [ADMIN_EMAIL],
  );

  if (existing.rows[0]) {
    console.log(`User already exists id=${existing.rows[0].id}`);
    return { id: existing.rows[0].id, created: false };
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const created = await pool.query<{ id: string }>(
    `INSERT INTO users (email, password, role, company_id, is_active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING id`,
    [ADMIN_EMAIL, passwordHash, ADMIN_ROLE, companyId],
  );

  console.log(`User created id=${created.rows[0]!.id}`);
  return { id: created.rows[0]!.id, created: true };
}

async function run(): Promise<void> {
  const company = await ensureCompany();

  await createTenantSchema(company.id);
  await pool.query(
    'UPDATE companies SET schema_provisioned = true, updated_at = NOW() WHERE id = $1',
    [company.id],
  );
  console.log(`Company schema provisioned id=${company.id}`);

  const user = await ensureUser(company.id);

  console.log(`Bootstrap complete companyId=${company.id} userId=${user.id}`);
}

run()
  .catch((error) => {
    console.error('Bootstrap failed:', error);
    process.exit(1);
  })
  .finally(() => {
    void pool.end();
  });
