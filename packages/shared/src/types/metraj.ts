export type OpeningType = 'door' | 'french-balcony' | 'window' | 'other';

export interface Opening {
  id: string;
  type: OpeningType;
  label: string;
  width: number;
  height: number;
  quantity: number;
  // areaSqm is always derived: width × height — never stored
}

export interface Room {
  id: string;
  name: string;
  length: number;
  width: number;
  ceilingHeight: number;
}

export interface FloorType {
  id: string;
  label: string;
  quantity: number;
  rooms: Room[];
  openings: Opening[];
}

export type ConcreteClass = 'C20' | 'C25' | 'C30' | 'C35' | 'C40' | 'C45';
export type RoughFloorTypeKey = 'basement' | 'ground' | 'upper';

export interface RoughSlabInput {
  areaSqm: number;
  thicknessM: number;
  concreteClass: ConcreteClass;
  unitPrice: number;
}

export interface RoughBasementWallInput {
  perimeterM: number;
  thicknessM: number;
  heightM: number;
  concreteClass: ConcreteClass;
  unitPrice: number;
}

export interface RoughColumnInput {
  widthM: number;
  depthM: number;
  quantity: number;
  concreteClass: ConcreteClass;
  unitPrice: number;
}

export interface RoughBeamInput {
  id: string;
  label: string;
  widthM: number;
  heightM: number;
  totalLengthM: number;
  concreteClass: ConcreteClass;
  unitPrice: number;
}

export interface RoughConstructionFloorType {
  id: string;
  key: RoughFloorTypeKey;
  label: string;
  quantity: number;
  ceilingHeightM: number;
  slab: RoughSlabInput;
  basementWall?: RoughBasementWallInput;
  column: RoughColumnInput;
  beams: RoughBeamInput[];
}

export interface RoughConstruction {
  floorTypes: RoughConstructionFloorType[];
}

export interface MetrajTakeoff {
  id: string;
  projectId: string;
  name: string;
  parcelCalculationId: string | null;
  floorTypes: FloorType[];
  roughConstruction: RoughConstruction | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface MetrajTakeoffPayload {
  name?: string;
  parcelCalculationId?: string | null;
  floorTypes: FloorType[];
  roughConstruction?: RoughConstruction | null;
}

// ─── Calculation result types ─────────────────────────────────────────────────

export interface RoomResult {
  roomId: string;
  grossArea: number;      // length × width
  perimeter: number;      // 2 × (length + width)
  grossWallArea: number;  // perimeter × ceilingHeight
}

export interface FloorTypeUnitResult {
  grossFloorArea: number;
  ceilingArea: number;
  grossWallArea: number;
  openingArea: number;
  netWallArea: number;
  skirtingLinear: number;
  rooms: RoomResult[];
}

export interface FloorTypeResult {
  floorTypeId: string;
  label: string;
  quantity: number;
  perUnit: FloorTypeUnitResult;
  total: FloorTypeUnitResult;
}

export interface TakeoffTotals {
  grossFloorArea: number;
  ceilingArea: number;
  grossWallArea: number;
  openingArea: number;
  netWallArea: number;
  skirtingLinear: number;
}

export interface TakeoffResult {
  floorTypes: FloorTypeResult[];
  totals: TakeoffTotals;
}
