export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tender {
  id: string;
  projectId: string;
  projectName?: string | null;
  title: string;
  description: string | null;
  status: string;
  budget: string | null;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenderInvitationResponse {
  tenantIds: string[];
}

export interface TenderOfferFile {
  id: string;
  tenderId: string;
  tenantId: string;
  tenantName: string | null;
  originalName: string;
  storedName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComparisonItem {
  description: string;
  unit: string;
  prices: Record<string, number>;
  cheapestTenantId: string;
  mostExpensiveTenantId: string;
}

export interface ComparisonResult {
  items: ComparisonItem[];
  totals: Record<string, number>;
  cheapestTenantId: string;
  tenantNames: Record<string, string>;
}

export interface TenderComparison {
  id: string;
  tenderId: string;
  status: string;
  resultJson: ComparisonResult | null;
  errorMessage: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
