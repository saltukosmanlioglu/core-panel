export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tender {
  id: string;
  projectId: string;
  projectName?: string | null;
  title: string;
  description: string | null;
  status: string;
  budget: string | null;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
}
