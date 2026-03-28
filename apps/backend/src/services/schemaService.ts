import fs from 'fs';
import path from 'path';
import { PoolClient } from 'pg';
import { pool } from '../db/connection';

// ─── Naming & sanitization ────────────────────────────────────────────────────

const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;

/**
 * Validate and convert a company UUID into a schema-safe identifier.
 * UUIDs use hyphens which are invalid in unquoted identifiers, so we
 * replace them with underscores. The result is always double-quoted in SQL.
 */
export function sanitizeCompanyId(companyId: string): string {
  if (!SAFE_ID_RE.test(companyId)) {
    throw new Error(`Invalid companyId: must be alphanumeric/hyphens/underscores only`);
  }
  return companyId.replace(/-/g, '_');
}

export function getTenantSchemaName(companyId: string): string {
  return `company_${sanitizeCompanyId(companyId)}`;
}

// ─── Schema lifecycle ─────────────────────────────────────────────────────────

/**
 * Create a dedicated PostgreSQL schema for a company and run all tenant
 * migrations inside it. Accepts an optional pg PoolClient so the operation
 * can participate in a caller-managed transaction.
 */
export async function createTenantSchema(
  companyId: string,
  client?: PoolClient,
): Promise<void> {
  const schemaName = getTenantSchemaName(companyId);
  const useClient = client ?? (await pool.connect());
  const shouldRelease = !client;

  try {
    await useClient.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    await _runMigrationsWithClient(useClient, schemaName);
  } finally {
    if (shouldRelease) (useClient as PoolClient).release();
  }
}

/**
 * Drop a company's dedicated schema (CASCADE). Accepts an optional client
 * so the operation can participate in a caller-managed transaction.
 */
export async function dropTenantSchema(
  companyId: string,
  client?: PoolClient,
): Promise<void> {
  const schemaName = getTenantSchemaName(companyId);
  const useClient = client ?? (await pool.connect());
  const shouldRelease = !client;

  try {
    await useClient.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  } finally {
    if (shouldRelease) (useClient as PoolClient).release();
  }
}

/**
 * List all user-created tables inside a company's schema.
 */
export async function listTenantTables(companyId: string): Promise<string[]> {
  const schemaName = getTenantSchemaName(companyId);
  const result = await pool.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = $1
       AND table_type = 'BASE TABLE'
       AND table_name != '_migrations'
     ORDER BY table_name`,
    [schemaName],
  );
  return result.rows.map((r) => r.table_name);
}

// ─── Migration runner (internal) ─────────────────────────────────────────────

/**
 * Run pending migrations for a schema using the provided client.
 * Migrations are tracked in a `_migrations` table inside the schema itself.
 */
export async function _runMigrationsWithClient(
  client: PoolClient,
  schemaName: string,
): Promise<void> {
  // Create migration tracker
  await client.query(`
    CREATE TABLE IF NOT EXISTS "${schemaName}"._migrations (
      id    SERIAL PRIMARY KEY,
      name  VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  for (const migration of TENANT_MIGRATIONS) {
    const existing = await client.query(
      `SELECT 1 FROM "${schemaName}"._migrations WHERE name = $1`,
      [migration.name],
    );
    if (existing.rows.length > 0) continue;

    // Execute each SQL statement in the migration
    for (const stmt of splitStatements(migration.sql(schemaName))) {
      await client.query(stmt);
    }

    await client.query(
      `INSERT INTO "${schemaName}"._migrations (name) VALUES ($1)`,
      [migration.name],
    );
  }
}

function splitStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ─── Migration definitions ────────────────────────────────────────────────────

const TENANT_MIGRATIONS_DIR = path.resolve(process.cwd(), 'src/migrations/tenant');

function loadTenantMigrations(): { name: string; sql: (schema: string) => string }[] {
  return fs
    .readdirSync(TENANT_MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((file) => {
      const raw = fs.readFileSync(path.join(TENANT_MIGRATIONS_DIR, file), 'utf-8');
      return {
        name: file.replace('.sql', ''),
        sql: (schema: string) => raw.replace(/\{\{schema\}\}/g, schema),
      };
    });
}

export const TENANT_MIGRATIONS = loadTenantMigrations();
