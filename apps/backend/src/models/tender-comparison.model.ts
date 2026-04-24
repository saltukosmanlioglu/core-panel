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
