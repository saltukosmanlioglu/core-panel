export interface ProjectPayload {
  name: string;
  description?: string;
  status: string;
}

export interface ProjectStatusPayload {
  status: 'active' | 'approved' | 'lost';
  note?: string;
}

export interface ProjectSummaryCounts {
  areaCalculations: number;
  models3d: number;
  propertyOwners: number;
  tenders: number;
  payments: number;
}

export interface FloorplannerProvisionPayload {
  user?: {
    email?: string;
    name?: string;
    externalIdentifier?: string;
  };
  project?: {
    name?: string;
    description?: string;
    externalIdentifier?: string;
  };
}

export interface FloorplannerProvisionResult {
  userId: string;
  authToken: string;
  projectId: string;
  environment: 'sandbox' | 'production';
  createdUser: boolean;
  createdProject: boolean;
}

export interface FloorplannerGenerateDrawingPayload {
  bedroomCount: number;
  area: number;
  kitchenType: 'open' | 'closed';
  extras: Array<'balcony' | 'homeOffice' | 'laundryRoom' | 'storage' | 'walkInCloset' | 'terrace'>;
  bathroomCount?: number;
  propertyType?: 'apartment' | 'villa' | 'office';
  floorCount?: number;
}

export interface FloorplannerFmlJson {
  walls: Array<{
    a: { x: number; y: number };
    b: { x: number; y: number };
    thickness: number;
    openings: unknown[];
  }>;
  items: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  }>;
  areas: unknown[];
  labels: Array<{
    text: string;
    x: number;
    y: number;
  }>;
}

export interface FloorplannerDrawingResult {
  floorplannerProjectId: string;
  fml: FloorplannerFmlJson;
  environment: 'sandbox' | 'production';
}

export interface FloorplannerExportResult {
  id: string;
  status: string;
  url?: string;
}

export interface BoqItemPayload {
  id?: string;
  description: string;
  unit: string;
  quantity: number;
  location?: string;
}

export interface TenderPayload {
  projectId: string;
  categoryId?: string | null;
  title: string;
  description?: string;
  status: string;
  deadline?: string;
}

export interface TenderQueryParams {
  limit?: number;
  projectId?: string;
  sortOrder?: 'asc' | 'desc';
}
