import { z } from 'zod';

export const paymentStatuses = ['draft', 'approved', 'paid', 'overdue'] as const;
export const expenseCategories = ['material', 'labor', 'equipment', 'other'] as const;
export const paymentFrequencies = ['weekly', 'biweekly', 'monthly', 'custom', 'none'] as const;
export const expenseStatuses = ['pending', 'paid'] as const;

const nullableDateString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
);

export const progressPaymentItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().min(0).default(1),
  unit: z.string().max(50).optional(),
  unitPrice: z.coerce.number().min(0).default(0),
  amount: z.coerce.number().min(0).optional(),
});

export const createProgressPaymentSchema = z.object({
  tenantId: z.string().min(1),
  tenderId: z.string().uuid().optional().nullable(),
  period: z.string().max(255).optional(),
  totalAmount: z.coerce.number().min(0),
  dueDate: nullableDateString,
  paymentFrequency: z.enum(paymentFrequencies).default('none'),
  note: z.string().optional(),
  items: z.array(progressPaymentItemSchema).default([]),
});

export const updateProgressPaymentSchema = z.object({
  status: z.enum(paymentStatuses).optional(),
  totalAmount: z.coerce.number().min(0).optional(),
  paidAmount: z.coerce.number().min(0).optional(),
  remainingAmount: z.coerce.number().min(0).optional(),
  dueDate: nullableDateString.nullable(),
  paymentFrequency: z.enum(paymentFrequencies).optional(),
  period: z.string().max(255).optional().nullable(),
  note: z.string().optional().nullable(),
});

export const createPaymentTransactionSchema = z.object({
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.coerce.number().positive(),
  note: z.string().optional(),
});

export const createGeneralExpenseSchema = z.object({
  category: z.enum(expenseCategories).default('other'),
  description: z.string().min(1),
  amount: z.coerce.number().min(0),
  paymentDate: nullableDateString,
  status: z.enum(expenseStatuses).default('pending'),
  note: z.string().optional(),
});

export const updateGeneralExpenseSchema = createGeneralExpenseSchema.partial();

export type CreateProgressPaymentInput = z.infer<typeof createProgressPaymentSchema>;
export type UpdateProgressPaymentInput = z.infer<typeof updateProgressPaymentSchema>;
export type CreatePaymentTransactionInput = z.infer<typeof createPaymentTransactionSchema>;
export type CreateGeneralExpenseInput = z.infer<typeof createGeneralExpenseSchema>;
export type UpdateGeneralExpenseInput = z.infer<typeof updateGeneralExpenseSchema>;

export const PAYMENT_FILE_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;
