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
  malzemeBirimFiyat: number | null;
  isciliikBirimFiyat: number | null;
  hasMalzemeIscilikAyri: boolean;
  tutar: number | null;
  isCheapest: boolean;
  isMostExpensive: boolean;
}

export interface ComparisonRow {
  siraNo: number;
  description: string;
  unit: string;
  prices: Record<string, ComparisonPriceCell>;
}

export interface ComparisonSummary {
  potentialSavings: number;
  minimumPossibleTotal: number;
  maximumPossibleTotal: number;
  tenantStats: Record<string, {
    cheapestCount: number;
    mostExpensiveCount: number;
    missingItems: number;
  }>;
}

export interface ComparisonResult {
  rows: ComparisonRow[];
  totals: Record<string, number>;
  cheapestTenantId: string | null;
  tenantNames: Record<string, string>;
  summary: ComparisonSummary;
}

export type AwardItemStatus = 'awarded' | 'pending_negotiation' | 'excluded';

export interface TenderAwardItem {
  id: string;
  tenderId: string;
  siraNo: number;
  description: string | null;
  awardedTenantId: string | null;
  status: AwardItemStatus;
  note: string | null;
  awardedBy: string;
  awardedAt: string;
  updatedAt: string;
}

export type RecommendationType =
  | 'strongly_recommended'
  | 'recommended'
  | 'close_price'
  | 'negotiate'
  | 'no_competition'
  | 'missing';

export interface ItemRecommendation {
  siraNo: number;
  description: string;
  unit: string;
  recommendedTenantId: string | null;
  recommendationType: RecommendationType;
  recommendationNote: string;
  priceDiffPercent: number | null;
}

export interface TenderAuditLog {
  id: string;
  tenderId: string;
  action: string;
  details: Record<string, unknown> | null;
  createdBy: string;
  createdByName: string | null;
  createdAt: string;
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
