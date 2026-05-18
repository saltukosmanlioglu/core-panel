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
  setbackSource: 'manual' | 'document';
  setbacks: Setbacks;
  floorCount: number;
  overhangs?: Overhang[];
}
