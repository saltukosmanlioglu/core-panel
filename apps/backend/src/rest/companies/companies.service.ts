import { pool } from '../../db/connection';
import { db } from '../../db/connection';
import { companies } from '../../db/schema';
import type { Company } from '../../db/schema';
import { eq } from 'drizzle-orm';
import {
  createTenantSchema,
  dropTenantSchema,
} from '../../services/schemaService';
import { AppError } from '../../lib/AppError';

/**
 * Create a company and atomically provision its dedicated PostgreSQL schema.
 *
 * Uses a raw pg transaction so that DDL (CREATE SCHEMA / CREATE TABLE) and
 * DML (INSERT INTO companies) share the same connection and are rolled back
 * together if anything fails.
 */
export async function createCompany(data: { name: string }): Promise<Company> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert company record (schema_provisioned defaults to false)
    const insertResult = await client.query<{
      id: string;
      name: string;
      schema_provisioned: boolean;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO companies (name)
       VALUES ($1)
       RETURNING id, name, schema_provisioned, created_at, updated_at`,
      [data.name],
    );
    const row = insertResult.rows[0]!;

    // 2. Provision the tenant schema inside the same transaction
    await createTenantSchema(row.id, client);

    // 3. Mark schema as provisioned
    await client.query(
      `UPDATE companies SET schema_provisioned = true, updated_at = NOW() WHERE id = $1`,
      [row.id],
    );

    await client.query('COMMIT');

    return {
      id: row.id,
      name: row.name,
      schemaProvisioned: true,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } as unknown as Company;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Delete a company and its dedicated schema atomically.
 * Returns false if the company was not found.
 */
export async function deleteCompany(id: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Drop the tenant schema (CASCADE removes all tables inside)
    await dropTenantSchema(id, client);

    // 2. Delete all users belonging to this company
    await client.query(`DELETE FROM users WHERE company_id = $1`, [id]);

    // 3. Delete the company record (also cascades tenants via FK)
    const result = await client.query(
      `DELETE FROM companies WHERE id = $1 RETURNING id`,
      [id],
    );

    await client.query('COMMIT');
    return result.rows.length > 0;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Re-provision the tenant schema for a company.
 * Safe to call on an already-provisioned company — uses IF NOT EXISTS throughout.
 */
export async function reprovisionSchema(id: string): Promise<Company> {
  const existing = await db
    .select()
    .from(companies)
    .where(eq(companies.id, id))
    .limit(1);

  if (!existing[0]) {
    throw new AppError('Company not found', 404, 'NOT_FOUND');
  }

  await createTenantSchema(id);

  const [updated] = await db
    .update(companies)
    .set({ schemaProvisioned: true, updatedAt: new Date() })
    .where(eq(companies.id, id))
    .returning();

  return updated!;
}
