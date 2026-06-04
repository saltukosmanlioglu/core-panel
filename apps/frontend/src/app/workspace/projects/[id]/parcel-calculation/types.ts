import type {
  Edge,
  ParcelCalculation,
  Point,
  TKGMParcelResult,
} from '@/services/parcel-calculations/types';

export type ParcelResultWithVertices = TKGMParcelResult & {
  parcelVertices?: Point[];
};

export type EdgeRole = 'front' | 'side' | 'back' | 'inactive';

export type FloorOptionIndex = 0 | 1 | 2;

export type NumericInputValue = number | string;

export interface EdgeRoleOption {
  role: EdgeRole;
  label: string;
  color: string;
}

export interface FloorOption {
  title: string;
  coverageRatio: number;
  footprintArea: number;
  floorCount: number;
}

export interface CalculationPreview extends ParcelCalculation {
  id: string;
}

export type ParcelEdge = Edge;
