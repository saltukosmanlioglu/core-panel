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
