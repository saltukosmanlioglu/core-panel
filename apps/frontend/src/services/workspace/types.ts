export interface ProjectPayload {
  name: string;
  description?: string;
  status: string;
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
  title: string;
  description?: string;
  status: string;
  deadline?: string;
}
