export enum UnitType {
  Apartment = 'apartment',
  Shop = 'shop',
  Common = 'common',
  Roof = 'roof',
}

export enum OwnerType {
  PropertyOwner = 'property_owner',
  Contractor = 'contractor',
  Common = 'common',
}

export interface RoughEstimate {
  id: string;
  projectId: string;
  netParcelArea: number | null;
  taksMin: number | null;
  taksMax: number | null;
  kaks: number | null;
  regulationBonusPercent: number | null;
  basementArea: number | null;
  secondBasementArea: number | null;
  thirdBasementArea: number | null;
  minBaseArea: number | null;
  maxBaseArea: number | null;
  maxConstructionArea: number | null;
  regulationBonusArea: number | null;
  totalBrutArea: number | null;
  floorCount: number;
  unitsPerFloor: number;
  hasRoofUnit: boolean;
  roofUnitArea: number | null;
  totalConstructionCost: number | null;
  costPerSqm: number | null;
  currency: string;
  usdRate: number | null;
  projectTitle: string | null;
  offerValidUntil: string | null;
  deliveryMonths: number;
  offerLetterTitle: string | null;
  offerLetterContent: string | null;
  notes: string | null;
  status: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoughEstimateUnit {
  id: string;
  estimateId: string;
  floorNumber: number;
  floorLabel: string | null;
  unitNumber: number;
  block: string | null;
  unitType: UnitType | string;
  ownerType: OwnerType | string;
  ownerName: string | null;
  propertyOwnerId: string | null;
  grossArea: number | null;
  fireEscapeArea: number | null;
  hasPayment: boolean;
  paymentAmount: number | null;
  notes: string | null;
  createdAt: string;
}

export interface RoughEstimateWithUnits extends RoughEstimate {
  units: RoughEstimateUnit[];
}

export type RoughEstimatePayload = Partial<
  Omit<RoughEstimate, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>
>;

export type RoughEstimateUnitPayload = Partial<
  Omit<RoughEstimateUnit, 'id' | 'estimateId' | 'createdAt'>
> & {
  floorNumber: number;
  unitNumber: number;
};
