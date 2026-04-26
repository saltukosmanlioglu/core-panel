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
