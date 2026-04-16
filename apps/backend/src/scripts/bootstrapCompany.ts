/**
 * Bootstrap a complete company setup in one shot:
 *   1. Creates the company + provisions its PostgreSQL schema
 *   2. Creates a company_admin user bound to that company
 *
 * Usage:
 *   npx tsx src/scripts/bootstrapCompany.ts \
 *     --company "Acme İnşaat" \
 *     --email   admin@acme.com \
 *     --password "SecurePass123!" \
 *     --name    "Ahmet Yılmaz"
 */

import 'dotenv/config';
import { parseArgs } from 'util';
import bcrypt from 'bcrypt';
import { createCompany } from '../rest/companies/companies.service';
import * as usersRepo from '../rest/users/users.repo';
import { pool } from '../db/connection';

const { values } = parseArgs({
  options: {
    company:  { type: 'string' },
    email:    { type: 'string' },
    password: { type: 'string' },
    name:     { type: 'string' },
  },
});

const { company: companyName, email, password, name } = values;

if (!companyName || !email || !password) {
  console.error('Usage: bootstrapCompany --company <name> --email <email> --password <pass> [--name <name>]');
  process.exit(1);
}

async function run() {
  console.log(`\nCreating company "${companyName}"…`);
  const company = await createCompany({ name: companyName! });
  console.log(`  ✓ Company created  id=${company.id}  schema=company_${company.id.replace(/-/g, '_')}`);

  console.log(`\nCreating company_admin "${email}"…`);
  const hashedPassword = await bcrypt.hash(password!, 12);
  const user = await usersRepo.create({
    email: email!,
    password: hashedPassword,
    name: name ?? null,
    role: 'company_admin',
    companyId: company.id,
    tenantId: null,
    isActive: true,
  });
  console.log(`  ✓ User created  id=${user.id}  companyId=${user.companyId}`);

  console.log('\n✅ Bootstrap complete. The user must set up MFA on first login.');
}

run()
  .catch((err) => { console.error('\n❌ Bootstrap failed:', err); process.exit(1); })
  .finally(() => pool.end());
