/**
 * Create a company_admin user from the command line.
 *
 *   npx tsx src/scripts/createUser.ts \
 *     --role company_admin \
 *     --email admin@acme.com \
 *     --password "Pass123!" \
 *     --company-id <uuid> \
 *     [--name "Ad Soyad"]
 */

import 'dotenv/config';
import { parseArgs } from 'util';
import bcrypt from 'bcrypt';
import * as usersRepo from '../rest/users/users.repo';
import * as companiesRepo from '../rest/companies/companies.repo';
import { pool } from '../db/connection';

const { values } = parseArgs({
  options: {
    role:         { type: 'string' },
    email:        { type: 'string' },
    password:     { type: 'string' },
    name:         { type: 'string' },
    'company-id': { type: 'string' },
  },
});

const { role, email, password, name } = values;
const companyId = values['company-id'];

if (!role || !email || !password) {
  console.error('Usage: createUser --role <company_admin> --email <email> --password <pass> --company-id <uuid> [--name <name>]');
  process.exit(1);
}

if (role !== 'company_admin') {
  console.error('--role must be company_admin');
  process.exit(1);
}

if (role === 'company_admin' && !companyId) {
  console.error('company_admin requires --company-id');
  process.exit(1);
}

async function run() {
  let resolvedCompanyId = companyId ?? null;

  if (role === 'company_admin') {
    const company = await companiesRepo.findById(companyId!);
    if (!company) { console.error(`❌ Company not found: ${companyId}`); process.exit(1); }
    console.log(`\nCreating company_admin for company "${company.name}"…`);
  }

  const hashedPassword = await bcrypt.hash(password!, 12);
  const user = await usersRepo.create({
    email: email!,
    password: hashedPassword,
    name: name ?? null,
    role: role!,
    companyId: resolvedCompanyId,
    tenantId: null,
    isActive: true,
  });

  console.log(`  ✓ User created  id=${user.id}  role=${user.role}  companyId=${user.companyId}  tenantId=${user.tenantId}`);
  console.log('\nUser must set up MFA on first login.');
}

run()
  .catch((err) => { console.error('\n❌ Failed:', err); process.exit(1); })
  .finally(() => pool.end());
