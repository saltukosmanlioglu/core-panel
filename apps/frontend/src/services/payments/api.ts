import type {
  ExpenseSummary,
  GeneralExpense,
  PaymentNotification,
  ProgressPayment,
  ProgressPaymentTransaction,
  TenantPaymentSummary,
} from '@core-panel/shared';
import { apiClient } from '../api-client';

export interface ProgressPaymentItemPayload {
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  amount?: number;
}

export interface ProgressPaymentPayload {
  tenantId: string;
  tenderId?: string | null;
  period?: string;
  totalAmount: number;
  dueDate?: string;
  paymentFrequency: string;
  note?: string;
  items: ProgressPaymentItemPayload[];
}

export interface ExpensePayload {
  category: string;
  description: string;
  amount: number;
  paymentDate?: string;
  status: string;
  note?: string;
  invoice?: File | null;
}

function toExpenseFormData(data: ExpensePayload): FormData {
  const form = new FormData();
  form.append('category', data.category);
  form.append('description', data.description);
  form.append('amount', String(data.amount));
  form.append('status', data.status);
  if (data.paymentDate) form.append('paymentDate', data.paymentDate);
  if (data.note) form.append('note', data.note);
  if (data.invoice) form.append('invoice', data.invoice);
  return form;
}

export async function getTenantPaymentSummariesApi(projectId: string): Promise<TenantPaymentSummary[]> {
  const res = await apiClient.get(`/api/projects/${projectId}/payments/tenants`);
  return (res.data as { tenants: TenantPaymentSummary[] }).tenants;
}

export async function getProgressPaymentsApi(projectId: string, tenantId?: string): Promise<ProgressPayment[]> {
  const res = await apiClient.get(`/api/projects/${projectId}/payments`, { params: tenantId ? { tenantId } : undefined });
  return (res.data as { payments: ProgressPayment[] }).payments;
}

export async function createProgressPaymentApi(projectId: string, data: ProgressPaymentPayload): Promise<ProgressPayment> {
  const res = await apiClient.post(`/api/projects/${projectId}/payments`, data);
  return (res.data as { payment: ProgressPayment }).payment;
}

export async function approveProgressPaymentApi(id: string): Promise<ProgressPayment> {
  const res = await apiClient.post(`/api/payments/${id}/approve`);
  return (res.data as { payment: ProgressPayment }).payment;
}

export async function createPaymentTransactionApi(
  paymentId: string,
  data: { paymentDate: string; amount: number; note?: string; receipt?: File | null },
): Promise<{ transaction: ProgressPaymentTransaction; payment: ProgressPayment }> {
  const form = new FormData();
  form.append('paymentDate', data.paymentDate);
  form.append('amount', String(data.amount));
  if (data.note) form.append('note', data.note);
  if (data.receipt) form.append('receipt', data.receipt);
  const res = await apiClient.post(`/api/payments/${paymentId}/transactions`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data as { transaction: ProgressPaymentTransaction; payment: ProgressPayment };
}

export async function deletePaymentTransactionApi(paymentId: string, txId: string): Promise<void> {
  await apiClient.delete(`/api/payments/${paymentId}/transactions/${txId}`);
}

export async function getExpensesApi(
  projectId: string,
  filters?: { category?: string; status?: string },
): Promise<GeneralExpense[]> {
  const res = await apiClient.get(`/api/projects/${projectId}/expenses`, { params: filters });
  return (res.data as { expenses: GeneralExpense[] }).expenses;
}

export async function createExpenseApi(projectId: string, data: ExpensePayload): Promise<GeneralExpense> {
  const res = await apiClient.post(`/api/projects/${projectId}/expenses`, toExpenseFormData(data), {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return (res.data as { expense: GeneralExpense }).expense;
}

export async function deleteExpenseApi(projectId: string, id: string): Promise<void> {
  await apiClient.delete(`/api/projects/${projectId}/expenses/${id}`);
}

export async function getExpenseSummaryApi(projectId: string): Promise<ExpenseSummary> {
  const res = await apiClient.get(`/api/projects/${projectId}/expenses/summary`);
  return (res.data as { summary: ExpenseSummary }).summary;
}

export async function downloadPaymentsExportApi(projectId: string): Promise<Blob> {
  const res = await apiClient.get(`/api/projects/${projectId}/payments/export`, { responseType: 'blob' });
  return res.data as Blob;
}

export async function getUnreadPaymentNotificationsApi(): Promise<PaymentNotification[]> {
  const res = await apiClient.get('/api/notifications');
  return (res.data as { notifications: PaymentNotification[] }).notifications;
}

export async function markPaymentNotificationReadApi(id: string): Promise<PaymentNotification> {
  const res = await apiClient.put(`/api/notifications/${id}/read`);
  return (res.data as { notification: PaymentNotification }).notification;
}

export async function markAllNotificationsReadApi(): Promise<{ updated: number }> {
  const res = await apiClient.put('/api/notifications/read-all');
  return res.data as { updated: number };
}
