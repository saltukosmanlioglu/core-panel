import type { ItemRecommendation, TenderAuditLog, TenderAwardItem } from '@core-panel/shared';
import { apiClient } from '../api-client';

export async function getTenderAwardItems(tenderId: string): Promise<TenderAwardItem[]> {
  const res = await apiClient.get(`/api/tenders/${tenderId}/awards`);
  return (res.data as { items: TenderAwardItem[] }).items;
}

export async function getTenderRecommendations(tenderId: string): Promise<ItemRecommendation[]> {
  const res = await apiClient.get(`/api/tenders/${tenderId}/awards/recommendations`);
  return (res.data as { recommendations: ItemRecommendation[] }).recommendations;
}

export async function bulkUpsertAwardItems(
  tenderId: string,
  items: Array<{
    siraNo: number;
    description?: string;
    awardedTenantId: string | null;
    status: 'awarded' | 'pending_negotiation' | 'excluded';
    note?: string;
  }>,
): Promise<TenderAwardItem[]> {
  const res = await apiClient.put(`/api/tenders/${tenderId}/awards`, { items });
  return (res.data as { items: TenderAwardItem[] }).items;
}

export async function finalizeTender(tenderId: string, note?: string): Promise<{ status: string }> {
  const res = await apiClient.post(`/api/tenders/${tenderId}/awards/finalize`, { note });
  return res.data as { status: string };
}

export async function getTenderAuditLog(tenderId: string): Promise<TenderAuditLog[]> {
  const res = await apiClient.get(`/api/tenders/${tenderId}/audit-log`);
  return (res.data as { logs: TenderAuditLog[] }).logs;
}
