import type { TenderCategory } from '@core-panel/shared';
import { apiClient } from '../api-client';

export async function getTenderCategoriesApi(tenderId: string): Promise<TenderCategory[]> {
  const res = await apiClient.get(`/api/tenders/${tenderId}/categories`);
  return (res.data as { categories: TenderCategory[] }).categories;
}

export async function createTenderCategoryApi(tenderId: string, data: { name: string; orderNo?: number }): Promise<TenderCategory> {
  const res = await apiClient.post(`/api/tenders/${tenderId}/categories`, data);
  return (res.data as { category: TenderCategory }).category;
}

export async function updateTenderCategoryApi(tenderId: string, categoryId: string, data: { name?: string; orderNo?: number }): Promise<TenderCategory> {
  const res = await apiClient.put(`/api/tenders/${tenderId}/categories/${categoryId}`, data);
  return (res.data as { category: TenderCategory }).category;
}

export async function deleteTenderCategoryApi(tenderId: string, categoryId: string): Promise<void> {
  await apiClient.delete(`/api/tenders/${tenderId}/categories/${categoryId}`);
}
