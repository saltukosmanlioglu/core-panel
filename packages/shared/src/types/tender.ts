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

export interface TenderCategory {
  id: string;
  tenderId: string;
  name: string;
  orderNo: number;
  createdAt: string;
  updatedAt: string;
}

export interface TenderItem {
  id: string;
  tenderId: string;
  categoryId: string | null;
  rowNo: number;
  posNo: string | null;
  description: string;
  unit: string;
  quantity: string;
  location: string | null;
  orderNo: number;
  createdAt: string;
  updatedAt: string;
}

export interface TenderOffer {
  id: string;
  tenderId: string;
  tenantId: string;
  tenantName?: string | null;
  status: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenderOfferItem {
  id: string;
  offerId: string;
  itemId: string;
  rowNo: number;
  description: string;
  unit: string;
  quantity: string;
  materialUnitPrice: string;
  laborUnitPrice: string;
  unitPrice: string;
  tutar: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfferComparisonItemPrice {
  offerId: string;
  tenantId: string;
  materialUnitPrice: string;
  laborUnitPrice: string;
  unitPrice: string;
  tutar: string;
}

export interface OfferComparisonItem {
  id: string;
  rowNo: number;
  description: string;
  unit: string;
  quantity: string;
  location: string | null;
  prices: OfferComparisonItemPrice[];
}

export interface OfferComparisonOffer {
  id: string;
  tenantId: string;
  tenantName: string | null;
  status: string;
  submittedAt: string | null;
  total: string;
}

export interface OfferComparison {
  offers: OfferComparisonOffer[];
  items: OfferComparisonItem[];
}
