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

export async function getLatestParcelArea(projectId: string): Promise<number | null> {
  const res = await apiClient.get(`${basePath(projectId)}/parcel-area`);
  return (res.data as { parcelArea: number | null }).parcelArea;
}

export async function downloadOfferPdf(projectId: string, id: string): Promise<Blob> {
  const res = await apiClient.get(`${basePath(projectId)}/${id}/generate-pdf`, {
    responseType: 'blob',
  });
  return res.data as Blob;
}
