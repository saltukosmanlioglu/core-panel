import { apiClient } from '../api-client';
import type { MetrajTakeoff, MetrajTakeoffPayload } from '@core-panel/shared';

export async function getMetrajTakeoff(projectId: string): Promise<MetrajTakeoff | null> {
  const res = await apiClient.get(`/api/projects/${projectId}/metraj`);
  return (res.data as { takeoff: MetrajTakeoff | null }).takeoff;
}

export async function saveMetrajTakeoff(
  projectId: string,
  data: MetrajTakeoffPayload,
): Promise<MetrajTakeoff> {
  const res = await apiClient.post(`/api/projects/${projectId}/metraj`, data);
  return (res.data as { takeoff: MetrajTakeoff }).takeoff;
}

export async function deleteMetrajTakeoff(id: string): Promise<void> {
  await apiClient.delete(`/api/metraj/${id}`);
}
