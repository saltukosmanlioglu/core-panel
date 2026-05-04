import type { PriceList } from '@core-panel/shared';
import { apiClient } from '../api-client';

export async function getPriceListApi(projectId: string, kdvRate?: number): Promise<PriceList> {
  const res = await apiClient.get(`/api/projects/${projectId}/price-list`, {
    params: kdvRate !== undefined ? { kdvRate } : undefined,
  });
  return res.data as PriceList;
}

export async function downloadPriceListExcelApi(projectId: string, kdvRate: number): Promise<void> {
  const res = await apiClient.get(`/api/projects/${projectId}/price-list/export`, {
    params: { kdvRate },
    responseType: 'arraybuffer',
  });
  const blob = new Blob([res.data as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fiyat-listesi-${projectId}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
