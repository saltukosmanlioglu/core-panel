import type { AreaCalculation, CalculatedResults, ExtractedData } from '@core-panel/shared';
import { apiClient } from '../api-client';

export interface AnalyzeAreaCalculationPayload {
  rolovesi?: File | null;
  eimar?: File | null;
  planNotes?: File | null;
  otherFiles?: File[];
  note?: string;
}

export interface AnalyzeAreaCalculationResponse {
  id: string;
  extractedData: ExtractedData;
  calculatedResults: CalculatedResults;
  warnings: string[];
}

export async function analyzeAreaCalculationApi(
  projectId: string,
  data: AnalyzeAreaCalculationPayload,
): Promise<AnalyzeAreaCalculationResponse> {
  const formData = new FormData();

  if (data.rolovesi) formData.append('rolovesi', data.rolovesi);
  if (data.eimar) formData.append('eimar', data.eimar);
  if (data.planNotes) formData.append('plan_notes', data.planNotes);
  (data.otherFiles ?? []).forEach((file) => formData.append('other_files', file));
  if (data.note) formData.append('note', data.note);

  const res = await apiClient.post(`/api/projects/${projectId}/area-calculations/analyze`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data as AnalyzeAreaCalculationResponse;
}

export async function getLatestAreaCalculationApi(projectId: string): Promise<AreaCalculation | null> {
  const res = await apiClient.get(`/api/projects/${projectId}/area-calculations/latest`);
  return (res.data as { calculation: AreaCalculation | null }).calculation;
}

export async function getAreaCalculationsApi(projectId: string): Promise<AreaCalculation[]> {
  const res = await apiClient.get(`/api/projects/${projectId}/area-calculations`);
  return (res.data as { calculations: AreaCalculation[] }).calculations;
}

export async function getAreaCalculationApi(id: string): Promise<AreaCalculation> {
  const res = await apiClient.get(`/api/area-calculations/${id}`);
  return (res.data as { calculation: AreaCalculation }).calculation;
}

export async function deleteAreaCalculationApi(id: string): Promise<void> {
  await apiClient.delete(`/api/area-calculations/${id}`);
}
