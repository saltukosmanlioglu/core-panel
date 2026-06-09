export type OwnerType = 'mila' | 'tapu' | null;
export type UnitType = 'daire' | 'dukkan' | 'depo' | 'siginak' | 'ortak_alan' | 'diger';

export interface OfferUnit {
  id: string;
  ownerType: OwnerType;
  ownerName: string;
  unitType: UnitType;
  brutM2: number;
  paymentAmount: number | null;
  label: string | null;
  unitNumber: number | null;
  linkedUnitId: string | null;
  linkedUnitLabel: string | null;
  manualM2Override: boolean;
  mergedWithIds: string[];
  isMergedInto: string | null;
}

export interface StreetLabels {
  left: string | null;
  right: string | null;
  bottom: string | null;
}

export interface BasementFloor {
  label: string;
  isCommonArea: boolean;
  commonAreaM2: number | null;
  commonAreaLabel: string | null;
  units: OfferUnit[];
  streetLabels: StreetLabels;
}

export interface GroundFloor {
  exists: boolean;
  units: OfferUnit[];
  streetLabels: StreetLabels;
}

export interface NormalFloor {
  floorNumber: number;
  units: OfferUnit[];
}

export interface RoofFloor {
  exists: boolean;
  units: OfferUnit[];
}

export interface OfferBuilding {
  staircaseDeduction: number;
  basementFloors: BasementFloor[];
  groundFloor: GroundFloor;
  normalFloors: NormalFloor[];
  roofFloor: RoofFloor;
}

export interface OfferAlternative {
  id: string;
  label: string;
  building: OfferBuilding;
}

export interface OfferDocument {
  id: string;
  projectId: string;
  parcelTitle: string;
  offerDate: string;
  page2Content: string;
  tcmbRate: string;
  companyName: string;
  building: OfferBuilding;
  alternatives: OfferAlternative[];
  parcelCalculationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OfferDocumentPayload {
  parcelTitle: string;
  offerDate: string;
  page2Content: string;
  tcmbRate: string;
  companyName: string;
  building: OfferBuilding;
  alternatives: OfferAlternative[];
  parcelCalculationId: string | null;
}
