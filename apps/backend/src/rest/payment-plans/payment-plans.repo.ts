import { TenantDb } from '../../lib/tenantDb';
import type { CreatePaymentPlanInput, UpdatePaymentPlanInput, PayInstallmentInput } from '../../models/payment-plan.model';

interface PlanRow {
  id: string;
  property_owner_id: string;
  project_id: string;
  title: string | null;
  total_amount: string | number;
  currency: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

interface InstallmentRow {
  id: string;
  payment_plan_id: string;
  title: string | null;
  due_date: Date | string | null;
  amount: string | number;
  paid_at: Date | string | null;
  status: string;
  receipt_path: string | null;
  receipt_original_name: string | null;
  notes: string | null;
  created_at: Date;
}

function toNumber(v: string | number | null | undefined): number {
  return Number(v ?? 0);
}

function toDateStr(v: Date | string | null): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  return v.toISOString().slice(0, 10);
}

function mapInstallment(row: InstallmentRow) {
  return {
    id: row.id,
    planId: row.payment_plan_id,
    title: row.title,
    dueDate: toDateStr(row.due_date),
    amount: toNumber(row.amount),
    paidAt: toDateStr(row.paid_at),
    status: row.status,
    receiptPath: row.receipt_path,
    receiptOriginalName: row.receipt_original_name,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function mapPlan(row: PlanRow) {
  return {
    id: row.id,
    propertyOwnerId: row.property_owner_id,
    projectId: row.project_id,
    title: row.title,
    totalAmount: toNumber(row.total_amount),
    currency: row.currency,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    installments: [] as ReturnType<typeof mapInstallment>[],
  };
}

export type PaymentPlanRecord = ReturnType<typeof mapPlan>;
export type PaymentPlanInstallmentRecord = ReturnType<typeof mapInstallment>;

async function attachInstallments(tdb: TenantDb, plans: PaymentPlanRecord[]): Promise<PaymentPlanRecord[]> {
  if (plans.length === 0) return plans;
  const ids = plans.map((p) => p.id);
  const { rows } = await tdb.query<InstallmentRow>(
    `SELECT * FROM ${tdb.ref('payment_plan_installments')}
     WHERE payment_plan_id = ANY($1::uuid[])
     ORDER BY due_date ASC`,
    [ids],
  );
  const byPlan = new Map<string, ReturnType<typeof mapInstallment>[]>();
  rows.map(mapInstallment).forEach((inst) => {
    byPlan.set(inst.planId, [...(byPlan.get(inst.planId) ?? []), inst]);
  });
  return plans.map((plan) => ({ ...plan, installments: byPlan.get(plan.id) ?? [] }));
}

export async function findByOwnerId(tdb: TenantDb, ownerId: string): Promise<PaymentPlanRecord[]> {
  const { rows } = await tdb.query<PlanRow>(
    `SELECT * FROM ${tdb.ref('payment_plans')} WHERE property_owner_id = $1 ORDER BY created_at ASC`,
    [ownerId],
  );
  return attachInstallments(tdb, rows.map(mapPlan));
}

export async function findById(tdb: TenantDb, id: string): Promise<PaymentPlanRecord | null> {
  const { rows } = await tdb.query<PlanRow>(
    `SELECT * FROM ${tdb.ref('payment_plans')} WHERE id = $1 LIMIT 1`,
    [id],
  );
  if (!rows[0]) return null;
  const plans = await attachInstallments(tdb, [mapPlan(rows[0])]);
  return plans[0] ?? null;
}

export async function create(
  tdb: TenantDb,
  ownerId: string,
  projectId: string,
  data: CreatePaymentPlanInput,
): Promise<PaymentPlanRecord> {
  const { rows } = await tdb.query<PlanRow>(
    `INSERT INTO ${tdb.ref('payment_plans')}
       (property_owner_id, project_id, title, total_amount, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [ownerId, projectId, data.title ?? null, data.totalAmount, data.note ?? null],
  );
  const plan = mapPlan(rows[0]!);

  for (const inst of data.installments) {
    await tdb.query(
      `INSERT INTO ${tdb.ref('payment_plan_installments')} (payment_plan_id, due_date, amount, notes)
       VALUES ($1, $2, $3, $4)`,
      [plan.id, inst.dueDate, inst.amount, inst.note ?? null],
    );
  }

  return (await findById(tdb, plan.id))!;
}

export async function update(
  tdb: TenantDb,
  id: string,
  data: UpdatePaymentPlanInput,
): Promise<PaymentPlanRecord | null> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];

  if (data.title !== undefined) { params.push(data.title); setClauses.push(`title = $${params.length}`); }
  if (data.totalAmount !== undefined) { params.push(data.totalAmount); setClauses.push(`total_amount = $${params.length}`); }
  if (data.note !== undefined) { params.push(data.note || null); setClauses.push(`notes = $${params.length}`); }

  if (params.length === 0) return findById(tdb, id);

  params.push(id);
  await tdb.query(
    `UPDATE ${tdb.ref('payment_plans')} SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
    params,
  );
  return findById(tdb, id);
}

export async function remove(tdb: TenantDb, id: string): Promise<PaymentPlanRecord | null> {
  const plan = await findById(tdb, id);
  if (!plan) return null;
  await tdb.query(`DELETE FROM ${tdb.ref('payment_plans')} WHERE id = $1`, [id]);
  return plan;
}

export async function payInstallment(
  tdb: TenantDb,
  planId: string,
  installmentId: string,
  data: PayInstallmentInput,
  receiptPath?: string | null,
): Promise<PaymentPlanInstallmentRecord | null> {
  const { rows } = await tdb.query<InstallmentRow>(
    `UPDATE ${tdb.ref('payment_plan_installments')}
     SET paid_at = $1, status = 'paid', receipt_path = COALESCE($2, receipt_path), notes = COALESCE($3, notes)
     WHERE id = $4 AND payment_plan_id = $5 AND status = 'pending'
     RETURNING *`,
    [data.paidDate, receiptPath ?? null, data.note ?? null, installmentId, planId],
  );
  return rows[0] ? mapInstallment(rows[0]) : null;
}
