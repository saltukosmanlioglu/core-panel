export interface ProjectPayload {
  name: string;
  description?: string;
  status: string;
}

export interface TenderPayload {
  projectId: string;
  title: string;
  description?: string;
  status: string;
  budget?: string;
  deadline?: string;
}
