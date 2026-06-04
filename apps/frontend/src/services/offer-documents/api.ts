import { apiClient } from '../api-client';
import type {
  OfferDocument,
  OfferDocumentPayload,
} from './types';

function basePath(projectId: string): string {
  return `/api/projects/${projectId}/offer-documents`;
}

export async function getOfferDocuments(projectId: string): Promise<OfferDocument[]> {
  const res = await apiClient.get(basePath(projectId));
  return (res.data as { offerDocuments: OfferDocument[] }).offerDocuments;
}

export async function createOfferDocument(
  projectId: string,
  payload: OfferDocumentPayload,
): Promise<OfferDocument> {
  const res = await apiClient.post(basePath(projectId), payload);
  return (res.data as { offerDocument: OfferDocument }).offerDocument;
}

export async function updateOfferDocument(
  projectId: string,
  id: string,
  payload: OfferDocumentPayload,
): Promise<OfferDocument> {
  const res = await apiClient.put(`${basePath(projectId)}/${id}`, payload);
  return (res.data as { offerDocument: OfferDocument }).offerDocument;
}

export async function deleteOfferDocument(projectId: string, id: string): Promise<void> {
  await apiClient.delete(`${basePath(projectId)}/${id}`);
}

export interface ParcelCalculationAreaResult {
  footprintArea: number | null;
  floorAreas: Array<{ floorNumber: number; netArea: number }> | null;
}

export async function getLatestParcelArea(projectId: string): Promise<ParcelCalculationAreaResult> {
  const res = await apiClient.get(`${basePath(projectId)}/parcel-area`);
  const data = res.data as { footprintArea?: number | null; floorAreas?: Array<{ floorNumber: number; netArea: number }> | null };
  return {
    footprintArea: data.footprintArea ?? null,
    floorAreas: data.floorAreas ?? null,
  };
}

export async function downloadOfferPdf(projectId: string, id: string): Promise<Blob> {
  const res = await apiClient.get(`${basePath(projectId)}/${id}/generate-pdf`, {
    responseType: 'blob',
  });
  return res.data as Blob;
}
