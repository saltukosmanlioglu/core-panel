import type { PaymentPlan, PaymentPlanInstallment } from '@core-panel/shared';
import { apiClient } from '../api-client';

export interface CreatePaymentPlanPayload {
  title?: string;
  totalAmount: number;
  note?: string;
  installments: { dueDate: string; amount: number; note?: string }[];
}

export interface UpdatePaymentPlanPayload {
  title?: string;
  totalAmount?: number;
  note?: string;
  status?: string;
}

export interface PayInstallmentPayload {
  paidDate: string;
  note?: string;
}

export async function getPaymentPlansApi(ownerId: string): Promise<PaymentPlan[]> {
  const res = await apiClient.get(`/api/property-owners/${ownerId}/payment-plans`);
  return (res.data as { plans: PaymentPlan[] }).plans;
}

export async function createPaymentPlanApi(ownerId: string, data: CreatePaymentPlanPayload): Promise<PaymentPlan> {
  const res = await apiClient.post(`/api/property-owners/${ownerId}/payment-plans`, data);
  return (res.data as { plan: PaymentPlan }).plan;
}

export async function updatePaymentPlanApi(id: string, data: UpdatePaymentPlanPayload): Promise<PaymentPlan> {
  const res = await apiClient.put(`/api/payment-plans/${id}`, data);
  return (res.data as { plan: PaymentPlan }).plan;
}

export async function deletePaymentPlanApi(id: string): Promise<void> {
  await apiClient.delete(`/api/payment-plans/${id}`);
}

export async function payInstallmentApi(
  planId: string,
  installmentId: string,
  data: PayInstallmentPayload,
  receiptFile?: File,
): Promise<{ installment: PaymentPlanInstallment; plan: PaymentPlan }> {
  const formData = new FormData();
  formData.append('paidDate', data.paidDate);
  if (data.note) formData.append('note', data.note);
  if (receiptFile) formData.append('receipt', receiptFile);

  const res = await apiClient.post(
    `/api/payment-plans/${planId}/installments/${installmentId}/pay`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return res.data as { installment: PaymentPlanInstallment; plan: PaymentPlan };
}
