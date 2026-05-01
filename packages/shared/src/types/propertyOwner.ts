export interface PropertyOwner {
  id: string;
  projectId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  idNumber: string | null;
  floorNumber: number | null;
  apartmentNumber: string | null;
  apartmentSizeSqm: number | null;
  sharePercentage: number | null;
  apartmentCount: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}
