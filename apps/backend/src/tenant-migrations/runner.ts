/**
 * Standalone migration runner for tenant schemas.
 *
 * Run with:
 *   npx tsx src/tenant-migrations/runner.ts
 *
 * Use-cases:
 *   - Apply new migrations to ALL existing company schemas after adding a new
 *     entry to the TENANT_MIGRATIONS array in schemaService.ts.
 *   - Verify which migrations have been applied to a specific schema.
 */

import 'dotenv/config';
import { pool } from '../db/connection';
import { getTenantSchemaName, _runMigrationsWithClient } from '../services/schemaService';

async function getAllCompanyIds(): Promise<{ id: string; name: string }[]> {
  const result = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM public.companies ORDER BY created_at`,
  );
  return result.rows;
}

async function runAllTenantMigrations(): Promise<void> {
  const companies = await getAllCompanyIds();

  if (companies.length === 0) {
    console.log('No companies found — nothing to migrate.');
    return;
  }

  console.log(`Running tenant migrations for ${companies.length} company schema(s)…\n`);

  for (const company of companies) {
    const schemaName = getTenantSchemaName(company.id);
    const client = await pool.connect();
    try {
      // Check schema exists before attempting migration
      const schemaCheck = await client.query(
        `SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`,
        [schemaName],
      );
      if (schemaCheck.rows.length === 0) {
        console.warn(`  [SKIP] "${company.name}" (${company.id}) — schema "${schemaName}" does not exist`);
        continue;
      }

      await client.query('BEGIN');
      await _runMigrationsWithClient(client, schemaName);
      await client.query('COMMIT');

      console.log(`  [OK]   "${company.name}" (${company.id}) → ${schemaName}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  [FAIL] "${company.name}" (${company.id}) →`, err);
    } finally {
      client.release();
    }
  }

  console.log('\nDone.');
}

runAllTenantMigrations()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
