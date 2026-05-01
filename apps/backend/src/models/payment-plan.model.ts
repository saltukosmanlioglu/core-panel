import { z } from 'zod';

const installmentSchema = z.object({
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçerli bir tarih girin (YYYY-MM-DD)'),
  amount: z.coerce.number().min(0, 'Tutar 0 veya üzeri olmalı'),
  note: z.string().optional(),
});

export const createPaymentPlanSchema = z.object({
  title: z.string().max(255).optional(),
  totalAmount: z.coerce.number().min(0, 'Toplam tutar 0 veya üzeri olmalı'),
  note: z.string().optional(),
  installments: z.array(installmentSchema).default([]),
});

export const updatePaymentPlanSchema = z.object({
  title: z.string().max(255).optional(),
  totalAmount: z.coerce.number().min(0).optional(),
  note: z.string().optional(),
  status: z.string().optional(),
});

export const payInstallmentSchema = z.object({
  paidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçerli bir tarih girin (YYYY-MM-DD)'),
  note: z.string().optional(),
});

export type CreatePaymentPlanInput = z.infer<typeof createPaymentPlanSchema>;
export type UpdatePaymentPlanInput = z.infer<typeof updatePaymentPlanSchema>;
export type PayInstallmentInput = z.infer<typeof payInstallmentSchema>;
