import { apiClient } from '../api-client';
import type { TenderOfferFile } from '@core-panel/shared';

export async function getTenderOfferFiles(tenderId: string): Promise<TenderOfferFile[]> {
  const res = await apiClient.get(`/api/tenders/${tenderId}/offer-files`);
  return (res.data as { offerFiles: TenderOfferFile[] }).offerFiles;
}

export async function uploadTenderOfferFile(tenderId: string, tenantId: string, file: File): Promise<TenderOfferFile> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('tenantId', tenantId);

  const res = await apiClient.post(`/api/tenders/${tenderId}/offer-files`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return (res.data as { offerFile: TenderOfferFile }).offerFile;
}

export async function deleteTenderOfferFile(tenderId: string, tenantId: string): Promise<void> {
  await apiClient.delete(`/api/tenders/${tenderId}/offer-files/${tenantId}`);
}
