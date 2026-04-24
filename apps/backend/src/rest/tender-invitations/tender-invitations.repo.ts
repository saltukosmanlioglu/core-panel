import { pool } from '../../db/connection';
import { TenantDb } from '../../lib/tenantDb';

interface TenderInvitationRow {
  tenant_id: string;
}

export async function findByTenderId(tdb: TenantDb, tenderId: string): Promise<string[]> {
  const { rows } = await tdb.query<TenderInvitationRow>(
    `SELECT tenant_id
     FROM ${tdb.ref('tender_invitations')}
     WHERE tender_id = $1
     ORDER BY created_at ASC`,
    [tenderId],
  );

  return rows.map((row) => row.tenant_id);
}

export async function replaceAll(tdb: TenantDb, tenderId: string, tenantIds: string[]): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM ${tdb.ref('tender_invitations')} WHERE tender_id = $1`, [tenderId]);

    if (tenantIds.length > 0) {
      for (const tenantId of tenantIds) {
        await client.query(
          `INSERT INTO ${tdb.ref('tender_invitations')} (tender_id, tenant_id)
           VALUES ($1, $2)`,
          [tenderId, tenantId],
        );
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
