import { apiClient } from '../api-client';
import type { FloorPlan, GenerateFloorPlanPayload } from './types';

export async function generateFloorPlanApi(
  projectId: string,
  data: GenerateFloorPlanPayload,
): Promise<{ floorPlan: FloorPlan; editorUrl: string }> {
  const res = await apiClient.post(`/api/projects/${projectId}/floor-plans/generate`, data);
  return res.data as { floorPlan: FloorPlan; editorUrl: string };
}

export async function getFloorPlansApi(projectId: string): Promise<FloorPlan[]> {
  const res = await apiClient.get(`/api/projects/${projectId}/floor-plans`);
  return (res.data as { floorPlans: FloorPlan[] }).floorPlans;
}

export async function getFloorPlanApi(id: string): Promise<{ floorPlan: FloorPlan; editorUrl: string | null }> {
  const res = await apiClient.get(`/api/floor-plans/${id}`);
  return res.data as { floorPlan: FloorPlan; editorUrl: string | null };
}

export async function deleteFloorPlanApi(id: string): Promise<void> {
  await apiClient.delete(`/api/floor-plans/${id}`);
}

export async function regenerateFloorPlanApi(id: string): Promise<{ floorPlan: FloorPlan; editorUrl: string }> {
  const res = await apiClient.post(`/api/floor-plans/${id}/regenerate`);
  return res.data as { floorPlan: FloorPlan; editorUrl: string };
}

export function getFloorPlanXmlUrl(id: string): string {
  return `/api/floor-plans/${id}/xml`;
}
