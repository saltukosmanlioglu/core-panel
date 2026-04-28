import type { Category } from '@core-panel/shared';
import apiClient from '../api-client';

export const getCategoriesApi = async (): Promise<Category[]> => {
  const res = await apiClient.get('/api/categories');
  return res.data as Category[];
};

export const createCategoryApi = async (data: { name: string }): Promise<Category> => {
  const res = await apiClient.post('/api/categories', data);
  return res.data as Category;
};

export const updateCategoryApi = async (id: string, data: { name: string }): Promise<Category> => {
  const res = await apiClient.put(`/api/categories/${id}`, data);
  return res.data as Category;
};

export const deleteCategoryApi = async (id: string): Promise<void> => {
  await apiClient.delete(`/api/categories/${id}`);
};

export const getTenantCategoriesApi = async (tenantId: string): Promise<string[]> => {
  const res = await apiClient.get(`/api/categories/tenants/${tenantId}/categories`);
  return (res.data as { categoryIds: string[] }).categoryIds;
};

export const updateTenantCategoriesApi = async (
  tenantId: string,
  categoryIds: string[]
): Promise<string[]> => {
  const res = await apiClient.put(`/api/categories/tenants/${tenantId}/categories`, { categoryIds });
  return (res.data as { categoryIds: string[] }).categoryIds;
};

export const getSupplierCategoriesApi = async (supplierId: string): Promise<string[]> => {
  const res = await apiClient.get(`/api/categories/suppliers/${supplierId}/categories`);
  return (res.data as { categoryIds: string[] }).categoryIds;
};

export const updateSupplierCategoriesApi = async (
  supplierId: string,
  categoryIds: string[]
): Promise<string[]> => {
  const res = await apiClient.put(`/api/categories/suppliers/${supplierId}/categories`, { categoryIds });
  return (res.data as { categoryIds: string[] }).categoryIds;
};

export const getTenantsByCategoryApi = async (categoryId: string): Promise<string[]> => {
  const res = await apiClient.get(`/api/categories/${categoryId}/tenants`);
  return (res.data as { tenantIds: string[] }).tenantIds;
};

export const getTenantCategoriesBatchApi = async (tenantIds: string[]): Promise<Record<string, string[]>> => {
  const res = await apiClient.get<Record<string, string[]>>('/api/categories/tenants/batch', {
    params: { tenantIds: tenantIds.join(',') },
  });
  return res.data;
};

export const getSupplierCategoriesBatchApi = async (supplierIds: string[]): Promise<Record<string, string[]>> => {
  const res = await apiClient.get<Record<string, string[]>>('/api/categories/suppliers/batch', {
    params: { supplierIds: supplierIds.join(',') },
  });
  return res.data;
};
