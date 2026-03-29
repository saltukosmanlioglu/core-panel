import type { TenderItem } from '@core-panel/shared';
import { apiClient } from '../api-client';

export interface TenderItemPayload {
  categoryId?: string | null;
  rowNo: number;
  posNo?: string;
  description: string;
  unit: string;
  quantity: number;
  location?: string;
  orderNo?: number;
}

export async function getTenderItemsApi(tenderId: string): Promise<TenderItem[]> {
  const res = await apiClient.get(`/api/tenders/${tenderId}/items`);
  return (res.data as { items: TenderItem[] }).items;
}

export async function createTenderItemApi(tenderId: string, data: TenderItemPayload): Promise<TenderItem> {
  const res = await apiClient.post(`/api/tenders/${tenderId}/items`, data);
  return (res.data as { item: TenderItem }).item;
}

export async function updateTenderItemApi(tenderId: string, itemId: string, data: Partial<TenderItemPayload>): Promise<TenderItem> {
  const res = await apiClient.put(`/api/tenders/${tenderId}/items/${itemId}`, data);
  return (res.data as { item: TenderItem }).item;
}

export async function deleteTenderItemApi(tenderId: string, itemId: string): Promise<void> {
  await apiClient.delete(`/api/tenders/${tenderId}/items/${itemId}`);
}

export async function reorderTenderItemsApi(tenderId: string, items: { id: string; orderNo: number }[]): Promise<void> {
  await apiClient.post(`/api/tenders/${tenderId}/items/reorder`, { items });
}
