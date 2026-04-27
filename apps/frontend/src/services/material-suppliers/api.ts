import apiClient from '../api-client';

export interface MaterialSupplier {
  id: string;
  companyId: string;
  name: string;
  contactName?: string | null;
  contactPhone?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialSupplierPayload {
  name: string;
  contactName?: string;
  contactPhone?: string;
}

export const getMaterialSuppliersApi = async (): Promise<MaterialSupplier[]> => {
  const res = await apiClient.get('/api/material-suppliers');
  return (res.data as { materialSuppliers: MaterialSupplier[] }).materialSuppliers;
};

export const getMaterialSupplierApi = async (id: string): Promise<MaterialSupplier> => {
  const res = await apiClient.get(`/api/material-suppliers/${id}`);
  return (res.data as { materialSupplier: MaterialSupplier }).materialSupplier;
};

export const createMaterialSupplierApi = async (
  data: MaterialSupplierPayload
): Promise<MaterialSupplier> => {
  const res = await apiClient.post('/api/material-suppliers', data);
  return (res.data as { materialSupplier: MaterialSupplier }).materialSupplier;
};

export const updateMaterialSupplierApi = async (
  id: string,
  data: MaterialSupplierPayload
): Promise<MaterialSupplier> => {
  const res = await apiClient.put(`/api/material-suppliers/${id}`, data);
  return (res.data as { materialSupplier: MaterialSupplier }).materialSupplier;
};

export const deleteMaterialSupplierApi = async (id: string): Promise<void> => {
  await apiClient.delete(`/api/material-suppliers/${id}`);
};
