export interface Edge {
  label: string;
  length: number;
  angle: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Setbacks {
  front: number;
  back: number;
  left: number;
  right: number;
}

export type SetbackExtractionSource = 'planNotes' | 'zoningDocument' | 'default';

export interface SetbackExtractionResult {
  final: Setbacks;
  fromPlanNotes: Record<keyof Setbacks, number | null> | null;
  fromZoningDocument: Record<keyof Setbacks, number | null> | null;
  hasConflict: boolean;
  sources: Record<keyof Setbacks, SetbackExtractionSource>;
}

export interface ZoningInfo {
  setbacks: {
    front: number | null;
    back: number | null;
    left: number | null;
    right: number | null;
  };
  taks: number | null;
  kaks: number | null;
  floorCount: number | null;
  buildingHeight: number | null;
  constructionOrder: string | null;
  buildingDepth: number | null;
  notes: string | null;
}

export type ParcelDocumentType = 'plan_notlari' | 'imar_durumu';
export type ExtractedFieldValue = string | number | null;
export type ExtractedDocumentFieldMap = Record<string, ExtractedFieldValue>;

export interface ExtractedFields {
  documentType: ParcelDocumentType;
  fields: ExtractedDocumentFieldMap;
  zoningInfo: ZoningInfo;
  fileUrl: string | null;
  originalName: string | null;
}

export interface ZoningExtractionResponse {
  fromImarDurumu: ZoningInfo | null;
  fromPlanNotes: ZoningInfo | null;
  merged: ZoningInfo;
  hasConflict: boolean;
}

export interface Overhang {
  floor: number;
  front: number;
  back: number;
  left: number;
  right: number;
}

export interface ParcelCalculation {
  id: string;
  projectId: string;
  name: string;
  edges: Edge[];
  parcelArea: number;
  parcelVertices: Point[];
  setbackSource: 'manual' | 'document';
  setbackFront: number;
  setbackBack: number;
  setbackLeft: number;
  setbackRight: number;
  planNotlariFileUrl?: string | null;
  planNotlariExtracted?: ExtractedDocumentFieldMap | null;
  imarDurumuFileUrl?: string | null;
  imarDurumuExtracted?: ExtractedDocumentFieldMap | null;
  footprintArea: number;
  footprintVertices: Point[];
  floorCount: number;
  overhangs: Overhang[];
  totalConstructionArea: number;
  status: string;
  createdAt: string;
}

export interface ParcelCalculationPayload {
  name?: string;
  edges: Edge[];
  parcelVertices?: Point[];
  setbackSource: 'manual' | 'document';
  setbacks: Setbacks;
  floorCount: number;
  overhangs?: Overhang[];
  planNotlariFileUrl?: string | null;
  planNotlariExtracted?: ExtractedDocumentFieldMap | null;
  imarDurumuFileUrl?: string | null;
  imarDurumuExtracted?: ExtractedDocumentFieldMap | null;
}

export interface AdministrativeItem {
  id: number;
  name: string;
}

export interface TKGMParcelInfo {
  provinceName: string;
  districtName: string;
  neighborhoodName: string;
  blockNo: string;
  parcelNo: string;
  landType: string;
  mapSheet: string;
  landStatus: string;
  summary: string;
}

export interface TKGMParcelResult {
  id: string;
  area: number;
  info: TKGMParcelInfo;
  edges: Array<{ label: string; length: number; angle: number }>;
  vertices: Array<{ x: number; y: number }>;
  coordinates: Array<{ lat: number; lng: number }>;
}
