export interface FileInfo {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  mimeType: string | null;
  uploadedBy: string;
  description: string | null;
  tags: string[] | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FileListResponse {
  files: FileInfo[];
  total: number;
  page: number;
  limit: number;
}
