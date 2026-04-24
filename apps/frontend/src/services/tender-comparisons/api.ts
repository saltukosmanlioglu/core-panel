import { apiClient } from '../api-client';
import type { TenderComparison } from '@core-panel/shared';

export async function getTenderComparison(tenderId: string): Promise<TenderComparison | null> {
  const res = await apiClient.get(`/api/tenders/${tenderId}/comparison`);
  return (res.data as { comparison: TenderComparison | null }).comparison;
}

export async function runTenderComparison(tenderId: string): Promise<TenderComparison> {
  const res = await apiClient.post(`/api/tenders/${tenderId}/comparison`);
  return (res.data as { comparison: TenderComparison }).comparison;
}
