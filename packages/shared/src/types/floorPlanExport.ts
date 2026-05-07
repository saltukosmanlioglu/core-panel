export interface FloorPlanFeature {
  id?: string;
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  [key: string]: unknown;
}

export interface FloorPlanRoom {
  name?: string;
  label?: string;
  text?: string;
  x?: number;
  y?: number;
  area?: number;
  floorNumber?: number;
  unitNumber?: number | string;
  [key: string]: unknown;
}

export interface FloorPlanMetadata {
  windows: FloorPlanFeature[];
  doors: FloorPlanFeature[];
  balconies: FloorPlanFeature[];
  rooms: FloorPlanRoom[];
  total_area: number;
  floor_count: number;
}

export interface FloorPlanExport {
  id: string;
  projectId: string;
  floorplannerExportId: string | null;
  imageUrl: string;
  fmlData?: unknown | null;
  planMetadata?: FloorPlanMetadata | null;
  createdAt: string;
}
