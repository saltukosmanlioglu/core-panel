import type { RoughEstimate, RoughEstimatePayload, RoughEstimateUnit, RoughEstimateUnitPayload, RoughEstimateWithUnits } from '@core-panel/shared';
import { apiClient } from '../api-client';

export async function getRoughEstimatesApi(projectId: string): Promise<RoughEstimate[]> {
  const res = await apiClient.get(`/api/projects/${projectId}/rough-estimates`);
  return (res.data as { estimates: RoughEstimate[] }).estimates;
}

export async function createRoughEstimateApi(
  projectId: string,
  data: RoughEstimatePayload & { units?: RoughEstimateUnitPayload[] },
): Promise<RoughEstimateWithUnits> {
  const res = await apiClient.post(`/api/projects/${projectId}/rough-estimates`, data);
  return (res.data as { estimate: RoughEstimateWithUnits }).estimate;
}

export async function getRoughEstimateApi(id: string): Promise<RoughEstimateWithUnits> {
  const res = await apiClient.get(`/api/rough-estimates/${id}`);
  return (res.data as { estimate: RoughEstimateWithUnits }).estimate;
}

export async function updateRoughEstimateApi(
  id: string,
  data: RoughEstimatePayload & { units?: RoughEstimateUnitPayload[] },
): Promise<RoughEstimateWithUnits> {
  const res = await apiClient.put(`/api/rough-estimates/${id}`, data);
  return (res.data as { estimate: RoughEstimateWithUnits }).estimate;
}

export async function deleteRoughEstimateApi(id: string): Promise<void> {
  await apiClient.delete(`/api/rough-estimates/${id}`);
}

export async function upsertRoughEstimateUnitsApi(id: string, units: RoughEstimateUnitPayload[]): Promise<RoughEstimateUnit[]> {
  const res = await apiClient.post(`/api/rough-estimates/${id}/units`, { units });
  return (res.data as { units: RoughEstimateUnit[] }).units;
}

async function downloadBlob(url: string, filename: string): Promise<void> {
  const res = await apiClient.post(url, {}, { responseType: 'arraybuffer' });
  const blob = new Blob([res.data as BlobPart]);
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

export async function downloadRoughEstimatePdfApi(id: string): Promise<void> {
  await downloadBlob(`/api/rough-estimates/${id}/export-pdf`, `kaba-hesap-${id}.pdf`);
}

export async function downloadRoughEstimateExcelApi(id: string): Promise<void> {
  await downloadBlob(`/api/rough-estimates/${id}/export-excel`, `kaba-hesap-${id}.xlsx`);
}
