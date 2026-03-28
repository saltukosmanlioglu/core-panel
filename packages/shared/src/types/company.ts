export interface Company {
  id: string;
  name: string;
  schemaProvisioned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  companyId: string;
  companyName?: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
}
