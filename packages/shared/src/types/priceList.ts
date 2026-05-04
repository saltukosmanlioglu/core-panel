export interface PriceListItem {
  siraNo: number;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
  note: string | null;
}

export interface PriceListTender {
  tenderId: string;
  tenderTitle: string;
  categoryName: string | null;
  status: string;
  items: PriceListItem[];
  tenderTotal: number;
}

export interface PriceListTenant {
  tenantId: string;
  tenantName: string;
  contactName: string | null;
  total: number;
  totalWithKdv: number;
  tenders: PriceListTender[];
}

export interface PriceList {
  projectId: string;
  generatedAt: string;
  grandTotal: number;
  grandTotalWithKdv: number;
  kdvRate: number;
  tenants: PriceListTenant[];
}
