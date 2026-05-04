import { TenantDb } from '../../lib/tenantDb';
import type {
  CreateGeneralExpenseInput,
  CreatePaymentTransactionInput,
  CreateProgressPaymentInput,
  UpdateGeneralExpenseInput,
  UpdateProgressPaymentInput,
} from '../../models/payment.model';

interface PaymentRow {
  id: string;
  project_id: string;
  tender_id: string | null;
  tender_title?: string | null;
  tenant_id: string;
  tenant_name?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  period: string | null;
  total_amount: string | number;
  paid_amount: string | number;
  remaining_amount: string | number;
  status: string;
  due_date: Date | string | null;
  payment_frequency: string | null;
  note: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

interface PaymentItemRow {
  id: string;
  payment_id: string;
  description: string;
  quantity: string | number | null;
  unit: string | null;
  unit_price: string | number;
  amount: string | number;
  created_at: Date;
}

interface PaymentTransactionRow {
  id: string;
  payment_id: string;
  payment_date: Date | string;
  amount: string | number;
  receipt_path: string | null;
  note: string | null;
  created_by: string | null;
  created_at: Date;
}

interface TenantSummaryRow {
  tenant_id: string;
  tenant_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  total_amount: string | number;
  paid_amount: string | number;
  remaining_amount: string | number;
  last_payment_date: Date | string | null;
  next_due_date: Date | string | null;
  overdue_amount: string | number;
  payments_count: string | number;
  status: string;
}

interface ExpenseRow {
  id: string;
  project_id: string;
  category: string;
  description: string;
  amount: string | number;
  invoice_path: string | null;
  payment_date: Date | string | null;
  status: string;
  note: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

interface NotificationRow {
  id: string;
  company_id: string;
  user_id: string | null;
  type: string;
  message: string;
  related_id: string | null;
  related_type: string | null;
  related_project_id: string | null;
  is_read: boolean;
  created_at: Date;
}

function toNumber(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

function toDateString(value: Date | string | null): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function mapItem(row: PaymentItemRow) {
  return {
    id: row.id,
    paymentId: row.payment_id,
    description: row.description,
    quantity: toNumber(row.quantity),
    unit: row.unit,
    unitPrice: toNumber(row.unit_price),
    amount: toNumber(row.amount),
    createdAt: row.created_at,
  };
}

function mapTransaction(row: PaymentTransactionRow) {
  return {
    id: row.id,
    paymentId: row.payment_id,
    paymentDate: toDateString(row.payment_date)!,
    amount: toNumber(row.amount),
    receiptPath: row.receipt_path,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapPayment(row: PaymentRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    tenderId: row.tender_id,
    tenderTitle: row.tender_title ?? null,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name ?? null,
    contactName: row.contact_name ?? null,
    contactPhone: row.contact_phone ?? null,
    period: row.period,
    totalAmount: toNumber(row.total_amount),
    paidAmount: toNumber(row.paid_amount),
    remainingAmount: toNumber(row.remaining_amount),
    status: row.status,
    dueDate: toDateString(row.due_date),
    paymentFrequency: row.payment_frequency ?? 'none',
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: [] as ReturnType<typeof mapItem>[],
    transactions: [] as ReturnType<typeof mapTransaction>[],
  };
}

function mapSummary(row: TenantSummaryRow) {
  return {
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    totalAmount: toNumber(row.total_amount),
    paidAmount: toNumber(row.paid_amount),
    remainingAmount: toNumber(row.remaining_amount),
    lastPaymentDate: toDateString(row.last_payment_date),
    nextDueDate: toDateString(row.next_due_date),
    status: row.status,
    overdueAmount: toNumber(row.overdue_amount),
    paymentsCount: toNumber(row.payments_count),
  };
}

function mapExpense(row: ExpenseRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    category: row.category,
    description: row.description,
    amount: toNumber(row.amount),
    invoicePath: row.invoice_path,
    paymentDate: toDateString(row.payment_date),
    status: row.status,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapNotification(row: NotificationRow) {
  return {
    id: row.id,
    companyId: row.company_id,
    userId: row.user_id,
    type: row.type,
    message: row.message,
    relatedId: row.related_id,
    relatedType: row.related_type,
    relatedProjectId: row.related_project_id ?? null,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

export type ProgressPaymentRecord = ReturnType<typeof mapPayment>;
export type ProgressPaymentItemRecord = ReturnType<typeof mapItem>;
export type ProgressPaymentTransactionRecord = ReturnType<typeof mapTransaction>;
export type TenantPaymentSummaryRecord = ReturnType<typeof mapSummary>;
export type GeneralExpenseRecord = ReturnType<typeof mapExpense>;
export type PaymentNotificationRecord = ReturnType<typeof mapNotification>;

const PAYMENT_SELECT = `
  pp.*,
  tenants.name AS tenant_name,
  tenants.contact_name AS contact_name,
  tenants.contact_phone AS contact_phone,
  tenders.title AS tender_title
`;

async function attachRelations(tdb: TenantDb, payments: ProgressPaymentRecord[]): Promise<ProgressPaymentRecord[]> {
  if (payments.length === 0) return payments;
  const ids = payments.map((payment) => payment.id);
  const { rows: itemRows } = await tdb.query<PaymentItemRow>(
    `SELECT * FROM ${tdb.ref('progress_payment_items')}
     WHERE payment_id = ANY($1::uuid[])
     ORDER BY created_at ASC`,
    [ids],
  );
  const { rows: txRows } = await tdb.query<PaymentTransactionRow>(
    `SELECT * FROM ${tdb.ref('progress_payment_transactions')}
     WHERE payment_id = ANY($1::uuid[])
     ORDER BY payment_date DESC, created_at DESC`,
    [ids],
  );
  const itemsByPayment = new Map<string, ProgressPaymentItemRecord[]>();
  const txByPayment = new Map<string, ProgressPaymentTransactionRecord[]>();

  itemRows.map(mapItem).forEach((item) => {
    itemsByPayment.set(item.paymentId, [...(itemsByPayment.get(item.paymentId) ?? []), item]);
  });
  txRows.map(mapTransaction).forEach((tx) => {
    txByPayment.set(tx.paymentId, [...(txByPayment.get(tx.paymentId) ?? []), tx]);
  });

  return payments.map((payment) => ({
    ...payment,
    items: itemsByPayment.get(payment.id) ?? [],
    transactions: txByPayment.get(payment.id) ?? [],
  }));
}

export async function findTenantSummaries(tdb: TenantDb, projectId: string): Promise<TenantPaymentSummaryRecord[]> {
  const { rows } = await tdb.query<TenantSummaryRow>(
    `SELECT
       pp.tenant_id,
       tenants.name AS tenant_name,
       tenants.contact_name,
       tenants.contact_phone,
       COALESCE(SUM(pp.total_amount), 0) AS total_amount,
       COALESCE(SUM(pp.paid_amount), 0) AS paid_amount,
       COALESCE(SUM(pp.remaining_amount), 0) AS remaining_amount,
       MAX(tx.payment_date) AS last_payment_date,
       MIN(CASE WHEN pp.remaining_amount > 0 THEN pp.due_date END) AS next_due_date,
       COALESCE(SUM(CASE WHEN pp.due_date < CURRENT_DATE AND pp.remaining_amount > 0 THEN pp.remaining_amount ELSE 0 END), 0) AS overdue_amount,
       COUNT(DISTINCT pp.id) AS payments_count,
       CASE
         WHEN COALESCE(SUM(CASE WHEN pp.due_date < CURRENT_DATE AND pp.remaining_amount > 0 THEN pp.remaining_amount ELSE 0 END), 0) > 0 THEN 'overdue'
         WHEN COALESCE(SUM(pp.remaining_amount), 0) <= 0 THEN 'paid'
         WHEN SUM(CASE WHEN pp.status = 'approved' THEN 1 ELSE 0 END) > 0 THEN 'approved'
         ELSE 'draft'
       END AS status
     FROM ${tdb.ref('progress_payments')} pp
     LEFT JOIN "public"."tenants" tenants ON tenants.id::text = pp.tenant_id
     LEFT JOIN ${tdb.ref('progress_payment_transactions')} tx ON tx.payment_id = pp.id
     WHERE pp.project_id = $1
     GROUP BY pp.tenant_id, tenants.name, tenants.contact_name, tenants.contact_phone
     ORDER BY tenants.name ASC NULLS LAST`,
    [projectId],
  );

  return rows.map(mapSummary);
}

export async function findPayments(
  tdb: TenantDb,
  projectId: string,
  options: { tenantId?: string } = {},
): Promise<ProgressPaymentRecord[]> {
  const params: unknown[] = [projectId];
  const where = ['pp.project_id = $1'];

  if (options.tenantId) {
    params.push(options.tenantId);
    where.push(`pp.tenant_id = $${params.length}`);
  }

  const { rows } = await tdb.query<PaymentRow>(
    `SELECT ${PAYMENT_SELECT}
     FROM ${tdb.ref('progress_payments')} pp
     LEFT JOIN "public"."tenants" tenants ON tenants.id::text = pp.tenant_id
     LEFT JOIN ${tdb.ref('tenders')} tenders ON tenders.id = pp.tender_id
     WHERE ${where.join(' AND ')}
     ORDER BY pp.due_date ASC NULLS LAST, pp.created_at DESC`,
    params,
  );

  return attachRelations(tdb, rows.map(mapPayment));
}

export async function findPaymentById(tdb: TenantDb, id: string): Promise<ProgressPaymentRecord | null> {
  const { rows } = await tdb.query<PaymentRow>(
    `SELECT ${PAYMENT_SELECT}
     FROM ${tdb.ref('progress_payments')} pp
     LEFT JOIN "public"."tenants" tenants ON tenants.id::text = pp.tenant_id
     LEFT JOIN ${tdb.ref('tenders')} tenders ON tenders.id = pp.tender_id
     WHERE pp.id = $1
     LIMIT 1`,
    [id],
  );
  const payment = rows[0] ? mapPayment(rows[0]) : null;
  return payment ? (await attachRelations(tdb, [payment]))[0]! : null;
}

export async function createPayment(
  tdb: TenantDb,
  projectId: string,
  data: CreateProgressPaymentInput,
  userId: string,
): Promise<ProgressPaymentRecord> {
  const { rows } = await tdb.query<PaymentRow>(
    `INSERT INTO ${tdb.ref('progress_payments')}
       (project_id, tender_id, tenant_id, period, total_amount, paid_amount, remaining_amount, status, due_date, payment_frequency, note, created_by)
     VALUES ($1, $2, $3, $4, $5, 0, $5, 'draft', $6, $7, $8, $9)
     RETURNING *, NULL::text AS tenant_name, NULL::text AS contact_name, NULL::text AS contact_phone, NULL::text AS tender_title`,
    [
      projectId,
      data.tenderId ?? null,
      data.tenantId,
      data.period ?? null,
      data.totalAmount,
      data.dueDate ?? null,
      data.paymentFrequency,
      data.note ?? null,
      userId,
    ],
  );
  const payment = mapPayment(rows[0]!);

  for (const item of data.items) {
    const amount = item.amount ?? item.quantity * item.unitPrice;
    await tdb.query(
      `INSERT INTO ${tdb.ref('progress_payment_items')}
         (payment_id, description, quantity, unit, unit_price, amount)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [payment.id, item.description, item.quantity, item.unit ?? null, item.unitPrice, amount],
    );
  }

  return findPaymentById(tdb, payment.id) as Promise<ProgressPaymentRecord>;
}

export async function updatePayment(
  tdb: TenantDb,
  id: string,
  data: UpdateProgressPaymentInput,
): Promise<ProgressPaymentRecord | null> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];

  if (data.status !== undefined) { params.push(data.status); setClauses.push(`status = $${params.length}`); }
  if (data.totalAmount !== undefined) { params.push(data.totalAmount); setClauses.push(`total_amount = $${params.length}`); }
  if (data.paidAmount !== undefined) { params.push(data.paidAmount); setClauses.push(`paid_amount = $${params.length}`); }
  if (data.remainingAmount !== undefined) { params.push(data.remainingAmount); setClauses.push(`remaining_amount = $${params.length}`); }
  if (data.dueDate !== undefined) { params.push(data.dueDate); setClauses.push(`due_date = $${params.length}`); }
  if (data.paymentFrequency !== undefined) { params.push(data.paymentFrequency); setClauses.push(`payment_frequency = $${params.length}`); }
  if (data.period !== undefined) { params.push(data.period); setClauses.push(`period = $${params.length}`); }
  if (data.note !== undefined) { params.push(data.note); setClauses.push(`note = $${params.length}`); }

  if (params.length === 0) {
    return findPaymentById(tdb, id);
  }

  params.push(id);
  await tdb.query(
    `UPDATE ${tdb.ref('progress_payments')}
     SET ${setClauses.join(', ')}
     WHERE id = $${params.length}`,
    params,
  );
  return findPaymentById(tdb, id);
}

export async function approvePayment(tdb: TenantDb, id: string): Promise<ProgressPaymentRecord | null> {
  await tdb.query(
    `UPDATE ${tdb.ref('progress_payments')}
     SET status = 'approved', updated_at = NOW()
     WHERE id = $1 AND status = 'draft'`,
    [id],
  );
  return findPaymentById(tdb, id);
}

export async function removePayment(tdb: TenantDb, id: string): Promise<ProgressPaymentRecord | null> {
  const payment = await findPaymentById(tdb, id);
  if (!payment) return null;
  await tdb.query(`DELETE FROM ${tdb.ref('progress_payments')} WHERE id = $1`, [id]);
  return payment;
}

async function recalculatePayment(tdb: TenantDb, paymentId: string): Promise<void> {
  await tdb.query(
    `WITH totals AS (
       SELECT COALESCE(SUM(amount), 0) AS paid
       FROM ${tdb.ref('progress_payment_transactions')}
       WHERE payment_id = $1
     )
     UPDATE ${tdb.ref('progress_payments')} pp
     SET
       paid_amount = totals.paid,
       remaining_amount = GREATEST(pp.total_amount - totals.paid, 0),
       status = CASE WHEN GREATEST(pp.total_amount - totals.paid, 0) <= 0 THEN 'paid' ELSE pp.status END,
       updated_at = NOW()
     FROM totals
     WHERE pp.id = $1`,
    [paymentId],
  );
}

export async function createTransaction(
  tdb: TenantDb,
  paymentId: string,
  data: CreatePaymentTransactionInput,
  userId: string,
  receiptPath?: string | null,
): Promise<ProgressPaymentTransactionRecord> {
  const { rows } = await tdb.query<PaymentTransactionRow>(
    `INSERT INTO ${tdb.ref('progress_payment_transactions')}
       (payment_id, payment_date, amount, receipt_path, note, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [paymentId, data.paymentDate, data.amount, receiptPath ?? null, data.note ?? null, userId],
  );
  await recalculatePayment(tdb, paymentId);
  return mapTransaction(rows[0]!);
}

export async function findTransactions(tdb: TenantDb, paymentId: string): Promise<ProgressPaymentTransactionRecord[]> {
  const { rows } = await tdb.query<PaymentTransactionRow>(
    `SELECT * FROM ${tdb.ref('progress_payment_transactions')}
     WHERE payment_id = $1
     ORDER BY payment_date DESC, created_at DESC`,
    [paymentId],
  );
  return rows.map(mapTransaction);
}

export async function removeTransaction(
  tdb: TenantDb,
  paymentId: string,
  txId: string,
): Promise<ProgressPaymentTransactionRecord | null> {
  const { rows } = await tdb.query<PaymentTransactionRow>(
    `DELETE FROM ${tdb.ref('progress_payment_transactions')}
     WHERE id = $1 AND payment_id = $2
     RETURNING *`,
    [txId, paymentId],
  );
  await recalculatePayment(tdb, paymentId);
  return rows[0] ? mapTransaction(rows[0]) : null;
}

export async function findExpenses(
  tdb: TenantDb,
  projectId: string,
  filters: { category?: string; status?: string } = {},
): Promise<GeneralExpenseRecord[]> {
  const params: unknown[] = [projectId];
  const where = ['project_id = $1'];

  if (filters.category) {
    params.push(filters.category);
    where.push(`category = $${params.length}`);
  }

  if (filters.status) {
    params.push(filters.status);
    where.push(`status = $${params.length}`);
  }

  const { rows } = await tdb.query<ExpenseRow>(
    `SELECT * FROM ${tdb.ref('general_expenses')}
     WHERE ${where.join(' AND ')}
     ORDER BY payment_date DESC NULLS LAST, created_at DESC`,
    params,
  );
  return rows.map(mapExpense);
}

export async function findExpenseById(tdb: TenantDb, id: string): Promise<GeneralExpenseRecord | null> {
  const { rows } = await tdb.query<ExpenseRow>(
    `SELECT * FROM ${tdb.ref('general_expenses')} WHERE id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] ? mapExpense(rows[0]) : null;
}

export async function createExpense(
  tdb: TenantDb,
  projectId: string,
  data: CreateGeneralExpenseInput,
  userId: string,
  invoicePath?: string | null,
): Promise<GeneralExpenseRecord> {
  const { rows } = await tdb.query<ExpenseRow>(
    `INSERT INTO ${tdb.ref('general_expenses')}
       (project_id, category, description, amount, invoice_path, payment_date, status, note, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      projectId,
      data.category,
      data.description,
      data.amount,
      invoicePath ?? null,
      data.paymentDate ?? null,
      data.status,
      data.note ?? null,
      userId,
    ],
  );
  return mapExpense(rows[0]!);
}

export async function updateExpense(
  tdb: TenantDb,
  id: string,
  data: UpdateGeneralExpenseInput,
  invoicePath?: string | null,
): Promise<GeneralExpenseRecord | null> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];

  if (data.category !== undefined) { params.push(data.category); setClauses.push(`category = $${params.length}`); }
  if (data.description !== undefined) { params.push(data.description); setClauses.push(`description = $${params.length}`); }
  if (data.amount !== undefined) { params.push(data.amount); setClauses.push(`amount = $${params.length}`); }
  if (data.paymentDate !== undefined) { params.push(data.paymentDate); setClauses.push(`payment_date = $${params.length}`); }
  if (data.status !== undefined) { params.push(data.status); setClauses.push(`status = $${params.length}`); }
  if (data.note !== undefined) { params.push(data.note); setClauses.push(`note = $${params.length}`); }
  if (invoicePath !== undefined) { params.push(invoicePath); setClauses.push(`invoice_path = $${params.length}`); }

  if (params.length === 0) {
    return findExpenseById(tdb, id);
  }

  params.push(id);
  const { rows } = await tdb.query<ExpenseRow>(
    `UPDATE ${tdb.ref('general_expenses')}
     SET ${setClauses.join(', ')}
     WHERE id = $${params.length}
     RETURNING *`,
    params,
  );
  return rows[0] ? mapExpense(rows[0]) : null;
}

export async function removeExpense(tdb: TenantDb, id: string): Promise<GeneralExpenseRecord | null> {
  const { rows } = await tdb.query<ExpenseRow>(
    `DELETE FROM ${tdb.ref('general_expenses')} WHERE id = $1 RETURNING *`,
    [id],
  );
  return rows[0] ? mapExpense(rows[0]) : null;
}

export async function getExpenseSummary(tdb: TenantDb, projectId: string) {
  const { rows } = await tdb.query<{
    total: string | number;
    paid: string | number;
    pending: string | number;
    this_month: string | number;
    by_category: Record<string, number> | null;
  }>(
    `WITH category_totals AS (
       SELECT category, SUM(amount)::float AS amount
       FROM ${tdb.ref('general_expenses')}
       WHERE project_id = $1
       GROUP BY category
     )
     SELECT
       COALESCE((SELECT SUM(amount) FROM ${tdb.ref('general_expenses')} WHERE project_id = $1), 0) AS total,
       COALESCE((SELECT SUM(amount) FROM ${tdb.ref('general_expenses')} WHERE project_id = $1 AND status = 'paid'), 0) AS paid,
       COALESCE((SELECT SUM(amount) FROM ${tdb.ref('general_expenses')} WHERE project_id = $1 AND status = 'pending'), 0) AS pending,
       COALESCE((SELECT SUM(amount) FROM ${tdb.ref('general_expenses')} WHERE project_id = $1 AND payment_date >= date_trunc('month', CURRENT_DATE)), 0) AS this_month,
       COALESCE((SELECT jsonb_object_agg(category, amount) FROM category_totals), '{}'::jsonb) AS by_category`,
    [projectId],
  );
  const row = rows[0]!;
  return {
    total: toNumber(row.total),
    paid: toNumber(row.paid),
    pending: toNumber(row.pending),
    thisMonth: toNumber(row.this_month),
    byCategory: row.by_category ?? {},
  };
}

export async function ensureDueNotifications(
  tdb: TenantDb,
  companyId: string,
  projectId: string,
  userId: string,
): Promise<void> {
  await tdb.query(
    `INSERT INTO ${tdb.ref('payment_notifications')}
       (company_id, user_id, type, message, related_id, related_type, related_project_id)
     SELECT
       $1::uuid,
       $2::uuid,
       'payment_due_soon',
       CONCAT('Hakediş vadesi yaklaşıyor: ', COALESCE(tenants.name, pp.tenant_id), ' - ', COALESCE(pp.period, 'Dönem yok')),
       pp.id,
       'progress_payment',
       pp.project_id
     FROM ${tdb.ref('progress_payments')} pp
     LEFT JOIN "public"."tenants" tenants ON tenants.id::text = pp.tenant_id
     WHERE pp.project_id = $3
       AND pp.remaining_amount > 0
       AND pp.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
       AND NOT EXISTS (
         SELECT 1 FROM ${tdb.ref('payment_notifications')} pn
         WHERE pn.related_id = pp.id
           AND pn.related_type = 'progress_payment'
           AND pn.type = 'payment_due_soon'
           AND pn.user_id = $2::uuid
       )`,
    [companyId, userId, projectId],
  );
}

export async function findUnreadNotifications(
  tdb: TenantDb,
  companyId: string,
  userId: string,
): Promise<PaymentNotificationRecord[]> {
  const { rows } = await tdb.query<NotificationRow>(
    `SELECT * FROM ${tdb.ref('payment_notifications')}
     WHERE company_id = $1
       AND (user_id = $2 OR user_id IS NULL)
       AND is_read = FALSE
     ORDER BY created_at DESC
     LIMIT 50`,
    [companyId, userId],
  );
  return rows.map(mapNotification);
}

export async function markAllNotificationsRead(
  tdb: TenantDb,
  companyId: string,
  userId: string,
): Promise<number> {
  const { rowCount } = await tdb.query(
    `UPDATE ${tdb.ref('payment_notifications')}
     SET is_read = TRUE
     WHERE company_id = $1 AND (user_id = $2 OR user_id IS NULL) AND is_read = FALSE`,
    [companyId, userId],
  );
  return rowCount ?? 0;
}

export async function markNotificationRead(
  tdb: TenantDb,
  companyId: string,
  userId: string,
  id: string,
): Promise<PaymentNotificationRecord | null> {
  const { rows } = await tdb.query<NotificationRow>(
    `UPDATE ${tdb.ref('payment_notifications')}
     SET is_read = TRUE
     WHERE id = $1 AND company_id = $2 AND (user_id = $3 OR user_id IS NULL)
     RETURNING *`,
    [id, companyId, userId],
  );
  return rows[0] ? mapNotification(rows[0]) : null;
}
