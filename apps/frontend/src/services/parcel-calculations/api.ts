import { apiClient } from '../api-client';
import type {
  AdministrativeItem,
  ExtractedFields,
  ParcelCalculation,
  ParcelCalculationPayload,
  ParcelDocumentType,
  SetbackExtractionResult,
  TKGMParcelResult,
  ZoningInfo,
} from './types';

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

export async function extractSetbacks(projectId: string, formData: FormData): Promise<SetbackExtractionResult> {
  const res = await apiClient.post(`/api/projects/${projectId}/parcel-calculations/extract-setbacks`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return res.data as SetbackExtractionResult;
}

export async function extractZoningInfo(
  projectId: string,
  formData: FormData,
): Promise<{ merged: ZoningInfo; hasConflict: boolean }> {
  const res = await apiClient.post(`/api/projects/${projectId}/parcel-calculations/extract-zoning`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return res.data as { merged: ZoningInfo; hasConflict: boolean };
}

export async function extractParcelDocument(
  projectId: string,
  documentType: ParcelDocumentType,
  file: File,
): Promise<ExtractedFields> {
  const formData = new FormData();
  formData.append('documentType', documentType);
  formData.append('file', file);

  const res = await apiClient.post(`/api/projects/${projectId}/parcel-calculations/extract-zoning`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return res.data as ExtractedFields;
}

export async function getProvinces(): Promise<AdministrativeItem[]> {
  const res = await apiClient.get('/api/tkgm/provinces');
  return (res.data as { data: AdministrativeItem[] }).data;
}

export async function getDistricts(provinceId: number): Promise<AdministrativeItem[]> {
  const res = await apiClient.get(`/api/tkgm/districts/${provinceId}`);
  return (res.data as { data: AdministrativeItem[] }).data;
}

export async function getNeighborhoods(districtId: number): Promise<AdministrativeItem[]> {
  const res = await apiClient.get(`/api/tkgm/neighborhoods/${districtId}`);
  return (res.data as { data: AdministrativeItem[] }).data;
}

export async function fetchParcelFromTKGM(
  projectId: string,
  params: {
    neighborhoodId: number;
    blockNo: string;
    parcelNo: string;
    name?: string;
  },
): Promise<TKGMParcelResult> {
  const res = await apiClient.post(`/api/projects/${projectId}/parcel-calculations/fetch-from-tkgm`, params);
  return res.data as TKGMParcelResult;
}
