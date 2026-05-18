export interface ProjectPayload {
  name: string;
  description?: string;
  status: string;
}

export interface ProjectStatusPayload {
  status: 'active' | 'approved' | 'lost';
  note?: string;
}

export interface ProjectSummaryCounts {
  areaCalculations: number;
  models3d: number;
  propertyOwners: number;
  tenders: number;
  payments: number;
}

export interface BoqItemPayload {
  id?: string;
  description: string;
  unit: string;
  quantity: number;
  location?: string;
}

export interface TenderPayload {
  projectId: string;
  categoryId?: string | null;
  title: string;
  description?: string;
  status: string;
  deadline?: string;
}

export interface TenderQueryParams {
  limit?: number;
  projectId?: string;
  sortOrder?: 'asc' | 'desc';
}
