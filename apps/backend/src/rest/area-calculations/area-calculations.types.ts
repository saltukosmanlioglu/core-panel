export interface CoordinatePoint {
  [key: string]: unknown;
}

export interface DedicationInfo {
  [key: string]: unknown;
}

export interface ExtractedData {
  document_type: string;
  parcel: {
    ada: string | number | null;
    parsel: string | number | null;
    ilce: string | null;
    mahalle: string | null;
    plan_name: string | null;
    tapu_alani: number | string | null;
    net_alan: number | string | null;
    fonksiyon: string | null;
  };
  coordinates: CoordinatePoint[];
  front_facade: {
    edge_start_point: string | number | null;
    edge_end_point: string | number | null;
    description: string | null;
  };
  block_lines: {
    on_cizgisi_m: number | string | null;
    arka_cizgisi_m: number | string | null;
    on_cizgisi_reference: string | null;
    arka_cizgisi_reference: string | null;
  };
  dedications: DedicationInfo[];
  setbacks: {
    on_bahce: number | string | null;
    yan_bahce: number | string | null;
    arka_bahce: number | string | null;
    effective_west: number | string | null;
    note: string | null;
  };
  setback_increase_per_floor: {
    applies: boolean;
    above_floor: number | string | null;
    increase_per_floor_m: number | string | null;
    affected_setbacks: string[];
  };
  zoning: {
    kaks: number | string | null;
    taks_min: number | string | null;
    taks_max: number | string | null;
    kat_adedi: number | string | null;
    bina_yuksekligi: number | string | null;
    insaat_nizami: string | null;
    kaks_source: string | null;
    projection_included_in_kaks: boolean | string | null;
  };
  coefficient: {
    value: number | string | null;
    note: string | null;
  };
  warnings: string[];
}

export interface CalculatedResults {
  max_insaat_alani: number | null;
  max_taban_oturumu_min: number | null;
  max_taban_oturumu_max: number | null;
  polygon_area_calculated: number | null;
  dedication_area: number | null;
  net_area_calculated: number | null;
  net_area_source: string | null;
  area_discrepancy: number | null;
  buildable_width: number | null;
  buildable_depth: number | null;
  buildable_area_from_block_lines: number | null;
  buildable_area_source: 'block_lines' | 'setbacks' | null;
  floor_setbacks: FloorSetbacks[];
  setback_increase_applies: boolean;
  first_affected_floor: number | null;
  projection_bonus_area: number | null;
  adjusted_max_insaat_alani: number | null;
  projection_note: string | null;
  net_alan: number | null;
  tapu_alani: number | null;
  terk_alani: number | null;
  kat_adedi: number | null;
  bina_yuksekligi: number | null;
  insaat_nizami: string | null;
  kaks: number | null;
  taks_min: number | null;
  taks_max: number | null;
  on_bahce: number | null;
  yan_bahce: number | null;
  arka_bahce: number | null;
  setback_increase: ExtractedData['setback_increase_per_floor'];
  projection_included_in_kaks: boolean | string | null;
  coordinates: CoordinatePoint[];
  dedications: DedicationInfo[];
  block_lines: ExtractedData['block_lines'];
  front_facade: ExtractedData['front_facade'];
  coefficient: ExtractedData['coefficient'];
  ada_parsel: string | null;
}

export interface FloorSetbacks {
  floor: number;
  front_setback: number;
  side_setback: number;
  rear_setback: number;
  buildable_width: number | null;
  buildable_depth: number | null;
}

export interface AreaCalculation {
  id: string;
  projectId: string;
  status: string;
  rolovesiPath: string | null;
  eimarPath: string | null;
  planNotesPath: string | null;
  otherFiles: string[];
  extractedData: ExtractedData | null;
  calculatedResults: CalculatedResults | null;
  warnings: string[];
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}
