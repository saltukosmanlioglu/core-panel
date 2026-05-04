export enum PaymentStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
  PAID = 'paid',
  OVERDUE = 'overdue',
}

export enum ExpenseCategory {
  MATERIAL = 'material',
  LABOR = 'labor',
  EQUIPMENT = 'equipment',
  OTHER = 'other',
}

export enum PaymentFrequency {
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
  CUSTOM = 'custom',
  NONE = 'none',
}

export interface ProgressPaymentItem {
  id: string;
  paymentId: string;
  description: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  amount: number;
  createdAt: string;
}

export interface ProgressPaymentTransaction {
  id: string;
  paymentId: string;
  paymentDate: string;
  amount: number;
  receiptPath: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface ProgressPayment {
  id: string;
  projectId: string;
  tenderId: string | null;
  tenderTitle?: string | null;
  tenantId: string;
  tenantName?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  period: string | null;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: PaymentStatus | string;
  dueDate: string | null;
  paymentFrequency: PaymentFrequency | string;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  items: ProgressPaymentItem[];
  transactions: ProgressPaymentTransaction[];
}

export interface TenantPaymentSummary {
  tenantId: string;
  tenantName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  lastPaymentDate: string | null;
  nextDueDate: string | null;
  status: PaymentStatus | string;
  overdueAmount: number;
  paymentsCount: number;
}

export interface GeneralExpense {
  id: string;
  projectId: string;
  category: ExpenseCategory | string;
  description: string;
  amount: number;
  invoicePath: string | null;
  paymentDate: string | null;
  status: string;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseSummary {
  total: number;
  paid: number;
  pending: number;
  thisMonth: number;
  byCategory: Record<string, number>;
}

export interface PaymentNotification {
  id: string;
  companyId: string;
  userId: string | null;
  type: string;
  message: string;
  relatedId: string | null;
  relatedType: string | null;
  relatedProjectId: string | null;
  isRead: boolean;
  createdAt: string;
}
