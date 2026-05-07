import type { PropertyOwner } from '@core-panel/shared';
import { apiClient } from '../api-client';

export interface PropertyOwnerPayload {
  name: string;
  phone?: string;
  email?: string;
  idNumber?: string;
  floorNumber?: number | null;
  apartmentNumber?: string;
  apartmentSizeSqm?: number | null;
  sharePercentage?: number | null;
  apartmentCount?: number;
  note?: string;
}

export interface BulkPropertyOwnerPayload {
  name: string;
  floor_number: number | null;
  apartment_number: string;
  apartment_size_sqm: number | null;
  notes?: string;
}

export async function getPropertyOwnersApi(projectId: string): Promise<PropertyOwner[]> {
  const res = await apiClient.get(`/api/projects/${projectId}/property-owners`);
  return (res.data as { owners: PropertyOwner[] }).owners;
}

export async function createPropertyOwnerApi(projectId: string, data: PropertyOwnerPayload): Promise<PropertyOwner> {
  const res = await apiClient.post(`/api/projects/${projectId}/property-owners`, data);
  return (res.data as { owner: PropertyOwner }).owner;
}

export async function updatePropertyOwnerApi(id: string, data: PropertyOwnerPayload): Promise<PropertyOwner> {
  const res = await apiClient.put(`/api/property-owners/${id}`, data);
  return (res.data as { owner: PropertyOwner }).owner;
}

export async function bulkUpsertPropertyOwnersApi(projectId: string, owners: BulkPropertyOwnerPayload[]): Promise<PropertyOwner[]> {
  const res = await apiClient.post(`/api/projects/${projectId}/property-owners/bulk-upsert`, { owners });
  return (res.data as { owners: PropertyOwner[] }).owners;
}

export async function deletePropertyOwnerApi(id: string): Promise<void> {
  await apiClient.delete(`/api/property-owners/${id}`);
}
