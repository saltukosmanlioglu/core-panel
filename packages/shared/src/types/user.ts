export interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  companyId?: string | null;
  tenantId?: string | null;
  tenantName?: string | null;
  isActive: boolean;
  mfaEnabled: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
}

