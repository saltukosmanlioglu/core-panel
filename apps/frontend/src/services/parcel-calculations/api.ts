import { apiClient } from '../api-client';
import type { ParcelCalculation, ParcelCalculationPayload, Setbacks } from './types';

export async function createParcelCalculation(
  projectId: string,
  data: ParcelCalculationPayload,
): Promise<ParcelCalculation> {
  const res = await apiClient.post(`/api/projects/${projectId}/parcel-calculations`, data);
  return (res.data as { calculation: ParcelCalculation }).calculation;
}

export async function getParcelCalculations(projectId: string): Promise<ParcelCalculation[]> {
  const res = await apiClient.get(`/api/projects/${projectId}/parcel-calculations`);
  return (res.data as { calculations: ParcelCalculation[] }).calculations;
}

export async function getParcelCalculation(id: string): Promise<ParcelCalculation> {
  const res = await apiClient.get(`/api/parcel-calculations/${id}`);
  return (res.data as { calculation: ParcelCalculation }).calculation;
}

export async function updateParcelCalculation(
  id: string,
  data: ParcelCalculationPayload,
): Promise<ParcelCalculation> {
  const res = await apiClient.put(`/api/parcel-calculations/${id}`, data);
  return (res.data as { calculation: ParcelCalculation }).calculation;
}

export async function deleteParcelCalculation(id: string): Promise<void> {
  await apiClient.delete(`/api/parcel-calculations/${id}`);
}

export async function extractSetbacks(projectId: string, file: File): Promise<Setbacks> {
  const formData = new FormData();
  formData.append('document', file);

  const res = await apiClient.post(`/api/projects/${projectId}/parcel-calculations/extract-setbacks`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return res.data as Setbacks;
}
