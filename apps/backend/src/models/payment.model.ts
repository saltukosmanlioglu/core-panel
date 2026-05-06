import { z } from 'zod';

export const paymentStatuses = ['pending', 'approved', 'paid', 'overdue'] as const;
export const expenseCategories = ['material', 'labor', 'equipment', 'other'] as const;

const nullableDateString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
);

export const progressPaymentItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().min(0).default(1),
  unitPrice: z.coerce.number().min(0).default(0),
  totalPrice: z.coerce.number().min(0).optional(),
});

export const createProgressPaymentSchema = z.object({
  tenantId: z.string().min(1),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  totalAmount: z.coerce.number().min(0),
  dueDate: nullableDateString,
  items: z.array(progressPaymentItemSchema).default([]),
});

export const updateProgressPaymentSchema = z.object({
  status: z.enum(paymentStatuses).optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  totalAmount: z.coerce.number().min(0).optional(),
  paidAmount: z.coerce.number().min(0).optional(),
  dueDate: nullableDateString.nullable(),
});

export const createPaymentTransactionSchema = z.object({
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.coerce.number().positive(),
  notes: z.string().optional(),
});

export const createGeneralExpenseSchema = z.object({
  title: z.string().min(1).max(255),
  category: z.enum(expenseCategories).default('other'),
  description: z.string().optional(),
  amount: z.coerce.number().min(0),
  expenseDate: nullableDateString,
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
