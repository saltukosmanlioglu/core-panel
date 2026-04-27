import type { TenderItem } from '@core-panel/shared';
import apiClient from '../api-client';

export interface TenderItemPayload {
  id?: string;
  posNo?: string;
  description: string;
  unit: string;
  quantity: number;
  location?: string;
}

export const getTenderItemsApi = async (tenderId: string): Promise<TenderItem[]> => {
  const res = await apiClient.get(`/api/tenders/${tenderId}/items`);
  return (res.data as { items: TenderItem[] }).items;
};

export const replaceTenderItemsApi = async (
  tenderId: string,
  items: TenderItemPayload[],
): Promise<TenderItem[]> => {
  const res = await apiClient.put(`/api/tenders/${tenderId}/items`, { items });
  return (res.data as { items: TenderItem[] }).items;
};
