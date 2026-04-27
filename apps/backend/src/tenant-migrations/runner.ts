import 'dotenv/config';
import * as companiesRepo from '../rest/companies/companies.repo';
import { pool } from '../db/connection';
import { _runMigrationsWithClient, getTenantSchemaName } from '../services/schemaService';

async function run(): Promise<void> {
  const companies = await companiesRepo.findAll();

  for (const company of companies) {
    const schemaName = getTenantSchemaName(company.id);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      await _runMigrationsWithClient(client, schemaName);
      await client.query('COMMIT');
      console.log(`Applied tenant migrations for ${schemaName}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  console.log(`Tenant migrations complete for ${companies.length} companies`);
}

run()
  .catch((err) => {
    console.error('Tenant migration failed:', err);
    process.exit(1);
  })
  .finally(() => {
    void pool.end();
  });
