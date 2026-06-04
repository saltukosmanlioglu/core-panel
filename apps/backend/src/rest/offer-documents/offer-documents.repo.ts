import { TenantDb } from '../../lib/tenantDb';

export type OwnerType = 'mila' | 'tapu' | null;
export type UnitType = 'daire' | 'dukkan' | 'depo' | 'siginak' | 'ortak_alan' | 'diger';

export interface OfferUnit {
  id: number;
  ownerType: OwnerType;
  ownerName: string;
  unitType: UnitType;
  brutM2: number;
  paymentAmount: number | null;
  label: string | null;
  unitNumber: number | null;
  linkedUnitId: number | null;
  linkedUnitLabel: string | null;
  manualM2Override: boolean;
  mergedWithIds: number[];
  isMergedInto: number | null;
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

export interface OfferDocument {
  id: string;
  projectId: string;
  parcelTitle: string;
  offerDate: string;
  page2Content: string;
  tcmbRate: string;
  companyName: string;
  building: OfferBuilding;
  createdAt: string;
  updatedAt: string;
}

export interface OfferDocumentInput {
  parcelTitle: string;
  offerDate: string;
  page2Content: string;
  tcmbRate?: string;
  companyName?: string;
  building: OfferBuilding;
}

interface OfferDocumentRow {
  id: string;
  project_id: string;
  parcel_title: string;
  offer_date: Date | string;
  page2_content: string;
  tcmb_rate: string;
  company_name: string;
  building: unknown;
  created_at: Date;
  updated_at: Date;
}

const emptyStreetLabels: StreetLabels = {
  left: null,
  right: null,
  bottom: null,
};

export const defaultBuilding: OfferBuilding = {
  staircaseDeduction: 17.5,
  basementFloors: [
    {
      label: '1. BODRUM KAT',
      isCommonArea: true,
      commonAreaM2: null,
      commonAreaLabel: 'ORTAK ALAN',
      units: [],
      streetLabels: emptyStreetLabels,
    },
  ],
  groundFloor: {
    exists: true,
    units: [],
    streetLabels: emptyStreetLabels,
  },
  normalFloors: [
    {
      floorNumber: 1,
      units: [],
    },
  ],
  roofFloor: {
    exists: false,
    units: [],
  },
};

function dateString(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function dateTimeString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function numberOr(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function textOr(value: unknown, fallback: string): string {
  return textOrNull(value) ?? fallback;
}

function normalizeStreetLabels(value: unknown): StreetLabels {
  const record = asRecord(value);
  return {
    left: textOrNull(record.left),
    right: textOrNull(record.right),
    bottom: textOrNull(record.bottom),
  };
}

const VALID_UNIT_TYPES: UnitType[] = ['daire', 'dukkan', 'depo', 'siginak', 'ortak_alan', 'diger'];

function normalizeUnit(value: unknown, index: number, companyName: string): OfferUnit {
  const record = asRecord(value);

  const ownerType: OwnerType = record.ownerType === 'mila' ? 'mila'
    : record.ownerType === null ? null
    : 'tapu';

  const rawUnitType = record.unitType as UnitType;
  const unitType: UnitType = VALID_UNIT_TYPES.includes(rawUnitType) ? rawUnitType : 'daire';

  const defaultName = ownerType === 'mila' ? companyName
    : ownerType === 'tapu' ? 'TAPU SAHİBİ'
    : '';

  const linkedUnitId = record.linkedUnitId === null || record.linkedUnitId === undefined
    ? null
    : (Number.isFinite(Number(record.linkedUnitId)) ? Number(record.linkedUnitId) : null);

  const mergedWithIds = Array.isArray(record.mergedWithIds)
    ? (record.mergedWithIds as unknown[]).map(Number).filter(Number.isFinite)
    : [];

  const isMergedInto = record.isMergedInto === null || record.isMergedInto === undefined
    ? null
    : (Number.isFinite(Number(record.isMergedInto)) ? Number(record.isMergedInto) : null);

  return {
    id: numberOr(record.id, index + 1),
    ownerType,
    ownerName: textOr(record.ownerName, defaultName),
    unitType,
    brutM2: Math.max(0, numberOr(record.brutM2, 0)),
    paymentAmount: record.paymentAmount === null || record.paymentAmount === undefined || record.paymentAmount === ''
      ? null
      : Math.max(0, numberOr(record.paymentAmount, 0)),
    label: textOrNull(record.label),
    unitNumber: record.unitNumber === null || record.unitNumber === undefined
      ? null
      : (Number.isFinite(Number(record.unitNumber)) ? Math.trunc(Number(record.unitNumber)) : null),
    linkedUnitId,
    linkedUnitLabel: textOrNull(record.linkedUnitLabel),
    manualM2Override: record.manualM2Override === true,
    mergedWithIds,
    isMergedInto,
  };
}

function normalizeUnits(value: unknown, companyName: string): OfferUnit[] {
  return Array.isArray(value) ? value.map((v, i) => normalizeUnit(v, i, companyName)) : [];
}

function normalizeBuilding(value: unknown, companyName = ''): OfferBuilding {
  const record = asRecord(value);
  const basementFloors = Array.isArray(record.basementFloors)
    ? record.basementFloors.map((item, index) => {
      const floor = asRecord(item);
      return {
        label: textOr(floor.label, `${index + 1}. BODRUM KAT`),
        isCommonArea: floor.isCommonArea === true,
        commonAreaM2: floor.commonAreaM2 === null || floor.commonAreaM2 === undefined || floor.commonAreaM2 === ''
          ? null
          : Math.max(0, numberOr(floor.commonAreaM2, 0)),
        commonAreaLabel: textOrNull(floor.commonAreaLabel) ?? 'ORTAK ALAN',
        units: normalizeUnits(floor.units, companyName),
        streetLabels: normalizeStreetLabels(floor.streetLabels),
      };
    })
    : defaultBuilding.basementFloors;
  const groundFloor = asRecord(record.groundFloor);
  const roofFloor = asRecord(record.roofFloor);
  const normalFloors = Array.isArray(record.normalFloors)
    ? record.normalFloors.map((item, index) => {
      const floor = asRecord(item);
      return {
        floorNumber: Math.max(1, Math.trunc(numberOr(floor.floorNumber, index + 1))),
        units: normalizeUnits(floor.units, companyName),
      };
    })
    : defaultBuilding.normalFloors;

  return {
    staircaseDeduction: Math.max(0, numberOr(record.staircaseDeduction, 17.5)),
    basementFloors: basementFloors.length > 0 ? basementFloors : defaultBuilding.basementFloors,
    groundFloor: {
      exists: groundFloor.exists !== false,
      units: normalizeUnits(groundFloor.units, companyName),
      streetLabels: normalizeStreetLabels(groundFloor.streetLabels),
    },
    normalFloors: normalFloors.length > 0 ? normalFloors : defaultBuilding.normalFloors,
    roofFloor: {
      exists: roofFloor.exists === true,
      units: normalizeUnits(roofFloor.units, companyName),
    },
  };
}

function mapRow(row: OfferDocumentRow): OfferDocument {
  const companyName = row.company_name ?? '';
  return {
    id: row.id,
    projectId: row.project_id,
    parcelTitle: row.parcel_title,
    offerDate: dateString(row.offer_date),
    page2Content: row.page2_content,
    tcmbRate: row.tcmb_rate,
    companyName,
    building: normalizeBuilding(row.building, companyName),
    createdAt: dateTimeString(row.created_at),
    updatedAt: dateTimeString(row.updated_at),
  };
}

export async function findByProjectId(tdb: TenantDb, projectId: string): Promise<OfferDocument[]> {
  const { rows } = await tdb.query<OfferDocumentRow>(
    `SELECT * FROM ${tdb.ref('offer_documents')}
     WHERE project_id = $1
     ORDER BY created_at DESC`,
    [projectId],
  );
  return rows.map(mapRow);
}

export async function findById(tdb: TenantDb, projectId: string, id: string): Promise<OfferDocument | null> {
  const { rows } = await tdb.query<OfferDocumentRow>(
    `SELECT * FROM ${tdb.ref('offer_documents')}
     WHERE project_id = $1 AND id = $2
     LIMIT 1`,
    [projectId, id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function create(tdb: TenantDb, projectId: string, data: OfferDocumentInput): Promise<OfferDocument> {
  const companyName = data.companyName ?? '';
  const { rows } = await tdb.query<OfferDocumentRow>(
    `INSERT INTO ${tdb.ref('offer_documents')}
       (project_id, parcel_title, offer_date, page2_content, tcmb_rate, company_name, building)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING *`,
    [
      projectId,
      data.parcelTitle,
      data.offerDate,
      data.page2Content,
      data.tcmbRate ?? '1 Dolar (USD): 45,45 TL',
      companyName,
      JSON.stringify(normalizeBuilding(data.building, companyName)),
    ],
  );
  return mapRow(rows[0]!);
}

export async function update(
  tdb: TenantDb,
  projectId: string,
  id: string,
  data: OfferDocumentInput,
): Promise<OfferDocument | null> {
  const companyName = data.companyName ?? '';
  const { rows } = await tdb.query<OfferDocumentRow>(
    `UPDATE ${tdb.ref('offer_documents')}
     SET parcel_title = $3,
         offer_date = $4,
         page2_content = $5,
         tcmb_rate = $6,
         company_name = $7,
         building = $8::jsonb,
         updated_at = NOW()
     WHERE project_id = $1 AND id = $2
     RETURNING *`,
    [
      projectId,
      id,
      data.parcelTitle,
      data.offerDate,
      data.page2Content,
      data.tcmbRate ?? '1 Dolar (USD): 45,45 TL',
      companyName,
      JSON.stringify(normalizeBuilding(data.building, companyName)),
    ],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function deleteById(tdb: TenantDb, projectId: string, id: string): Promise<boolean> {
  const { rowCount } = await tdb.query(
    `DELETE FROM ${tdb.ref('offer_documents')}
     WHERE project_id = $1 AND id = $2`,
    [projectId, id],
  );
  return rowCount > 0;
}

export async function getParcelCalculationArea(tdb: TenantDb, projectId: string): Promise<number | null> {
  const { rows } = await tdb.query<{ footprint_area: string | number | null }>(
    `SELECT footprint_area
     FROM ${tdb.ref('parcel_calculations')}
     WHERE project_id = $1 AND footprint_area IS NOT NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [projectId],
  );
  const value = rows[0]?.footprint_area;
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
