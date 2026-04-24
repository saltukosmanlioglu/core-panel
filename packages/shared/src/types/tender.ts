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

export interface ComparisonPriceCell {
  price: number | null;
  isCheapest: boolean;
  isMostExpensive: boolean;
}

export interface ComparisonRow {
  description: string;
  unit: string;
  prices: Record<string, ComparisonPriceCell>;
}

export interface ComparisonResult {
  rows: ComparisonRow[];
  totals: Record<string, number>;
  cheapestTenantId: string | null;
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
