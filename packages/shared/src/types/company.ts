export interface Company {
  id: string;
  name: string;
  logoPath?: string | null;
  schemaProvisioned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  companyId: string;
  companyName?: string | null;
  name: string;
  contactName?: string | null;
  contactPhone?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  companyId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
