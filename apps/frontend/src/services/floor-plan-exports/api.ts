import type { FloorPlanExport } from '@core-panel/shared';
import { apiClient } from '../api-client';

export async function getProjectFloorPlanExportsApi(projectId: string): Promise<FloorPlanExport[]> {
  const res = await apiClient.get(`/api/projects/${projectId}/floor-plan-exports`);
  return (res.data as { exports: FloorPlanExport[] }).exports;
}

export async function getFloorPlanExportApi(id: string): Promise<FloorPlanExport> {
  const res = await apiClient.get(`/api/floor-plan-exports/${id}`);
  return (res.data as { export: FloorPlanExport }).export;
}

export async function deleteFloorPlanExportApi(id: string): Promise<void> {
  await apiClient.delete(`/api/floor-plan-exports/${id}`);
}
