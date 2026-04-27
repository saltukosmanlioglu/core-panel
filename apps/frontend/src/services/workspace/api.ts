import type { Project, Tender } from '@core-panel/shared';
import { apiClient } from '../api-client';
import type { ProjectPayload, TenderPayload, TenderQueryParams } from './types';

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function getProjectsApi(): Promise<Project[]> {
  const res = await apiClient.get('/api/projects');
  return (res.data as { projects: Project[] }).projects;
}

export async function getProjectApi(id: string): Promise<Project> {
  const res = await apiClient.get(`/api/projects/${id}`);
  return (res.data as { project: Project }).project;
}

export async function createProjectApi(data: ProjectPayload): Promise<Project> {
  const res = await apiClient.post('/api/projects', data);
  return (res.data as { project: Project }).project;
}

export async function updateProjectApi(id: string, data: ProjectPayload): Promise<Project> {
  const res = await apiClient.put(`/api/projects/${id}`, data);
  return (res.data as { project: Project }).project;
}

export async function deleteProjectApi(id: string): Promise<void> {
  await apiClient.delete(`/api/projects/${id}`);
}

// ─── Tenders ──────────────────────────────────────────────────────────────────

export async function getTendersApi(params?: TenderQueryParams): Promise<Tender[]> {
  const res = await apiClient.get('/api/tenders', { params });
  return (res.data as { tenders: Tender[] }).tenders;
}

export async function getTenderApi(id: string): Promise<Tender> {
  const res = await apiClient.get(`/api/tenders/${id}`);
  return (res.data as { tender: Tender }).tender;
}

export async function createTenderApi(data: TenderPayload): Promise<Tender> {
  const res = await apiClient.post('/api/tenders', data);
  return (res.data as { tender: Tender }).tender;
}

export async function updateTenderApi(id: string, data: TenderPayload): Promise<Tender> {
  const res = await apiClient.put(`/api/tenders/${id}`, data);
  return (res.data as { tender: Tender }).tender;
}

export async function deleteTenderApi(id: string): Promise<void> {
  await apiClient.delete(`/api/tenders/${id}`);
}
