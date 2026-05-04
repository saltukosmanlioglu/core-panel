import type { GenerationStep, ThreeDModel } from '@core-panel/shared';
import { apiClient } from '../api-client';

interface GenerateImagePayload {
  prompt: string;
}

interface GenerateImageResponse {
  id: string;
  imageTaskId: string;
  imageUrls: string[];
}

interface Generate3DResponse {
  id: string;
  meshyTaskId: string;
  status: GenerationStep;
}

export async function generateThreeDModelImagesApi(
  projectId: string,
  data: GenerateImagePayload,
): Promise<GenerateImageResponse> {
  const res = await apiClient.post(`/api/projects/${projectId}/3d-models/generate-image`, data);
  return res.data as GenerateImageResponse;
}

export async function createThreeDModelFromFloorPlanApi(
  projectId: string,
  data: { imageUrl: string; floorPlanExportId?: string },
): Promise<{ id: string; selectedImageUrl: string }> {
  const res = await apiClient.post(`/api/projects/${projectId}/3d-models/from-floor-plan`, data);
  const model = res.data as { id: string; selectedImageUrl: string };
  return model;
}

export async function generateThreeDModelFromImageApi(
  id: string,
  selectedImageUrl: string,
): Promise<Generate3DResponse> {
  const res = await apiClient.post(`/api/3d-models/${id}/generate-3d`, { selectedImageUrl });
  return res.data as Generate3DResponse;
}

export async function getThreeDModelStatusApi(id: string): Promise<ThreeDModel> {
  const res = await apiClient.get(`/api/3d-models/${id}/status`);
  return res.data as ThreeDModel;
}

export async function updateThreeDModelStatusApi(
  id: string,
  data: { status: GenerationStep; reason?: string },
): Promise<ThreeDModel> {
  const res = await apiClient.put(`/api/3d-models/${id}/status`, data);
  return res.data as ThreeDModel;
}

export async function getProjectThreeDModelsApi(projectId: string): Promise<ThreeDModel[]> {
  const res = await apiClient.get(`/api/projects/${projectId}/3d-models`);
  return (res.data as { models: ThreeDModel[] }).models;
}

export async function deleteThreeDModelApi(id: string): Promise<void> {
  await apiClient.delete(`/api/3d-models/${id}`);
}
