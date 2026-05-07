export interface FloorPlan {
  id: string;
  projectId: string;
  name: string;
  floorNumber: number | null;
  sh3doUserId: string | null;
  sh3doHomeName: string | null;
  apartmentCount: number | null;
  roomType: string | null;
  totalArea: number | null;
  aiPrompt: string | null;
  aiGeneratedXml: string | null;
  thumbnailUrl: string | null;
  status: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  editorUrl?: string | null;
}

export interface GenerateFloorPlanPayload {
  apartmentCount: number;
  roomType: string;
  name?: string;
  floorNumber?: number;
}
