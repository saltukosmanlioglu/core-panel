export enum ThreeDModelStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  COMPLETED = 'COMPLETED',
}

export enum GenerationStep {
  PENDING = 'PENDING',
  IMAGE_GENERATING = 'IMAGE_GENERATING',
  IMAGE_DONE = 'IMAGE_DONE',
  MODEL_GENERATING = 'MODEL_GENERATING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface ThreeDModel {
  id: string;
  projectId: string;
  prompt: string;
  texturePrompt: string | null;
  enhancedPrompt: string | null;
  meshyTaskId: string | null;
  meshyTextureTaskId: string | null;
  status: GenerationStep;
  progress: number;
  filePath: string | null;
  modelUrl?: string | null;
  thumbnailUrl: string | null;
  modelName: string | null;
  previewImageUrls: string[];
  originalImageUrls: string[];
  selectedImageUrl: string | null;
  imageTaskId: string | null;
  generationStep: GenerationStep;
  createdAt: string;
  updatedAt: string;
}
