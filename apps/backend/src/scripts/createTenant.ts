/**
 * Create a tenant under an existing company.
 *
 * Usage:
 *   npx tsx src/scripts/createTenant.ts \
 *     --company-id <uuid> \
 *     --name       "Taşeron A"
 */

import 'dotenv/config';
import { parseArgs } from 'util';
import * as tenantsRepo from '../rest/tenants/tenants.repo';
import * as companiesRepo from '../rest/companies/companies.repo';
import { pool } from '../db/connection';

const { values } = parseArgs({
  options: {
    'company-id': { type: 'string' },
    name:         { type: 'string' },
  },
});

const companyId = values['company-id'];
const tenantName = values['name'];

if (!companyId || !tenantName) {
  console.error('Usage: createTenant --company-id <uuid> --name <name>');
  process.exit(1);
}

async function run() {
  const company = await companiesRepo.findById(companyId!);
  if (!company) {
    console.error(`❌ Company not found: ${companyId}`);
    process.exit(1);
  }
  console.log(`\nCreating tenant "${tenantName}" under company "${company.name}"…`);
  const tenant = await tenantsRepo.create({ name: tenantName!, companyId: companyId! });
  console.log(`  ✓ Tenant created  id=${tenant.id}`);
}

run()
  .catch((err) => { console.error('\n❌ Failed:', err); process.exit(1); })
  .finally(() => pool.end());
