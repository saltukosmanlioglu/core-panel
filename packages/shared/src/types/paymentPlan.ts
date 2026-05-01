export interface PaymentPlanInstallment {
  id: string;
  planId: string;
  dueDate: string;
  amount: number;
  paidDate: string | null;
  status: string;
  receiptPath: string | null;
  note: string | null;
  createdAt: string;
}

export interface PaymentPlan {
  id: string;
  propertyOwnerId: string;
  projectId: string;
  title: string | null;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  installments: PaymentPlanInstallment[];
}
