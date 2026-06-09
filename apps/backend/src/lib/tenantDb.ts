import { Request } from 'express';
import { pool } from '../db/connection';
import { getTenantSchemaName, sanitizeCompanyId } from '../services/schemaService';

/**
 * Tenant-aware database helper.
 *
 * Every query is executed with an explicit schema-qualified table reference
 * (`"company_<id>"."<table>"`), keeping connection pool state clean and
 * avoiding `SET search_path` side-effects across pooled connections.
 *
 * Usage:
 *   const tdb = new TenantDb(companyId);
 *   const { rows } = await tdb.query<MyRow>('SELECT * FROM $T WHERE id = $1', ['file_info'], [id]);
 *
 * The special `$T` placeholder is expanded to `"schema"."table"`.
 */
export class TenantDb {
  private readonly schemaName: string;

  constructor(companyId: string) {
    // sanitizeCompanyId throws if the id contains unsafe characters
    sanitizeCompanyId(companyId);
    this.schemaName = getTenantSchemaName(companyId);
  }

  /**
   * Returns a safely double-quoted schema + table reference, e.g.
   * `"company_abc123"."file_info"`.
   * tableName must be a compile-time constant from our code — never user input.
   */
  ref(tableName: string): string {
    return `"${this.schemaName}"."${tableName}"`;
  }

  /**
   * Execute a parameterised query against the tenant schema.
   * Use `this.ref(tableName)` to build the table reference and embed it
   * directly in the SQL string (it is schema-sanitised).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async query<T extends Record<string, any> = Record<string, any>>(
    text: string,
    params: unknown[] = [],
  ): Promise<{ rows: T[]; rowCount: number }> {
    const result = await pool.query<T>(text, params);
    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
  }

  /**
   * Run multiple queries inside a single database transaction.
   * The callback receives a `query` function bound to the same pg client so
   * all statements share the connection and are rolled back atomically on error.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async withTransaction<TResult>(
    fn: (query: <T extends Record<string, any>>(text: string, params?: unknown[]) => Promise<{ rows: T[]; rowCount: number }>) => Promise<TResult>,
  ): Promise<TResult> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txQuery = async <T extends Record<string, any>>(text: string, params: unknown[] = []) => {
        const result = await client.query<T>(text, params);
        return { rows: result.rows, rowCount: result.rowCount ?? 0 };
      };
      const result = await fn(txQuery);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

export function getTdb(req: Pick<Request, 'resolvedCompanyId'>): TenantDb {
  if (!req.resolvedCompanyId) {
    throw new Error('No resolved company context');
  }

  return new TenantDb(req.resolvedCompanyId);
}
