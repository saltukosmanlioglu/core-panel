import { TenantDb } from '../../lib/tenantDb';
import type {
  RoughEstimate,
  RoughEstimateUnit,
  RoughEstimateUnitPayload,
  RoughEstimateWithUnits,
} from '@core-panel/shared';

type RoughEstimateInput = Partial<Omit<RoughEstimate, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>;

interface RoughEstimateRow {
  id: string;
  project_id: string;
  net_parcel_area: string | number | null;
  taks_min: string | number | null;
  taks_max: string | number | null;
  kaks: string | number | null;
  regulation_bonus_percent: string | number | null;
  basement_area: string | number | null;
  second_basement_area: string | number | null;
  third_basement_area: string | number | null;
  min_base_area: string | number | null;
  max_base_area: string | number | null;
  max_construction_area: string | number | null;
  regulation_bonus_area: string | number | null;
  total_brut_area: string | number | null;
  floor_count: number | null;
  units_per_floor: number | null;
  has_roof_unit: boolean | null;
  roof_unit_area: string | number | null;
  total_construction_cost: string | number | null;
  cost_per_sqm: string | number | null;
  currency: string | null;
  usd_rate: string | number | null;
  project_title: string | null;
  offer_valid_until: Date | string | null;
  delivery_months: number | null;
  offer_letter_title: string | null;
  offer_letter_content: string | null;
  notes: string | null;
  status: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

interface RoughEstimateUnitRow {
  id: string;
  estimate_id: string;
  floor_number: number;
  floor_label: string | null;
  unit_number: number;
  block: string | null;
  unit_type: string | null;
  owner_type: string | null;
  owner_name: string | null;
  property_owner_id: string | null;
  gross_area: string | number | null;
  fire_escape_area: string | number | null;
  has_payment: boolean | null;
  payment_amount: string | number | null;
  notes: string | null;
  created_at: Date;
}

const ESTIMATE_COLUMNS = [
  ['netParcelArea', 'net_parcel_area'],
  ['taksMin', 'taks_min'],
  ['taksMax', 'taks_max'],
  ['kaks', 'kaks'],
  ['regulationBonusPercent', 'regulation_bonus_percent'],
  ['basementArea', 'basement_area'],
  ['secondBasementArea', 'second_basement_area'],
  ['thirdBasementArea', 'third_basement_area'],
  ['minBaseArea', 'min_base_area'],
  ['maxBaseArea', 'max_base_area'],
  ['maxConstructionArea', 'max_construction_area'],
  ['regulationBonusArea', 'regulation_bonus_area'],
  ['totalBrutArea', 'total_brut_area'],
  ['floorCount', 'floor_count'],
  ['unitsPerFloor', 'units_per_floor'],
  ['hasRoofUnit', 'has_roof_unit'],
  ['roofUnitArea', 'roof_unit_area'],
  ['totalConstructionCost', 'total_construction_cost'],
  ['costPerSqm', 'cost_per_sqm'],
  ['currency', 'currency'],
  ['usdRate', 'usd_rate'],
  ['projectTitle', 'project_title'],
  ['offerValidUntil', 'offer_valid_until'],
  ['deliveryMonths', 'delivery_months'],
  ['offerLetterTitle', 'offer_letter_title'],
  ['offerLetterContent', 'offer_letter_content'],
  ['notes', 'notes'],
  ['status', 'status'],
  ['createdBy', 'created_by'],
] as const;

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDateOnly(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function mapEstimate(row: RoughEstimateRow): RoughEstimate {
  return {
    id: row.id,
    projectId: row.project_id,
    netParcelArea: toNumber(row.net_parcel_area),
    taksMin: toNumber(row.taks_min),
    taksMax: toNumber(row.taks_max),
    kaks: toNumber(row.kaks),
    regulationBonusPercent: toNumber(row.regulation_bonus_percent),
    basementArea: toNumber(row.basement_area),
    secondBasementArea: toNumber(row.second_basement_area),
    thirdBasementArea: toNumber(row.third_basement_area),
    minBaseArea: toNumber(row.min_base_area),
    maxBaseArea: toNumber(row.max_base_area),
    maxConstructionArea: toNumber(row.max_construction_area),
    regulationBonusArea: toNumber(row.regulation_bonus_area),
    totalBrutArea: toNumber(row.total_brut_area),
    floorCount: row.floor_count ?? 0,
    unitsPerFloor: row.units_per_floor ?? 2,
    hasRoofUnit: row.has_roof_unit ?? false,
    roofUnitArea: toNumber(row.roof_unit_area),
    totalConstructionCost: toNumber(row.total_construction_cost),
    costPerSqm: toNumber(row.cost_per_sqm),
    currency: row.currency ?? 'TRY',
    usdRate: toNumber(row.usd_rate),
    projectTitle: row.project_title,
    offerValidUntil: toDateOnly(row.offer_valid_until),
    deliveryMonths: row.delivery_months ?? 10,
    offerLetterTitle: row.offer_letter_title,
    offerLetterContent: row.offer_letter_content,
    notes: row.notes,
    status: row.status ?? 'draft',
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapUnit(row: RoughEstimateUnitRow): RoughEstimateUnit {
  return {
    id: row.id,
    estimateId: row.estimate_id,
    floorNumber: row.floor_number,
    floorLabel: row.floor_label,
    unitNumber: row.unit_number,
    block: row.block,
    unitType: row.unit_type ?? 'apartment',
    ownerType: row.owner_type ?? 'property_owner',
    ownerName: row.owner_name,
    propertyOwnerId: row.property_owner_id,
    grossArea: toNumber(row.gross_area),
    fireEscapeArea: toNumber(row.fire_escape_area),
    hasPayment: row.has_payment ?? true,
    paymentAmount: toNumber(row.payment_amount),
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
  };
}

function definedEstimateEntries(data: RoughEstimateInput): Array<[string, unknown]> {
  return ESTIMATE_COLUMNS
    .filter(([key]) => data[key] !== undefined)
    .map(([key, column]) => [column, data[key]]);
}

export async function create(
  tdb: TenantDb,
  projectId: string,
  data: RoughEstimateInput,
): Promise<RoughEstimate> {
  const entries = definedEstimateEntries(data);
  const columns = ['project_id', ...entries.map(([column]) => column)];
  const values = [projectId, ...entries.map(([, value]) => value)];
  const placeholders = values.map((_, index) => `$${index + 1}`);

  const { rows } = await tdb.query<RoughEstimateRow>(
    `INSERT INTO ${tdb.ref('rough_estimates')} (${columns.join(', ')})
     VALUES (${placeholders.join(', ')})
     RETURNING *`,
    values,
  );

  return mapEstimate(rows[0]!);
}

export async function update(
  tdb: TenantDb,
  id: string,
  data: RoughEstimateInput,
): Promise<RoughEstimate | null> {
  const entries = definedEstimateEntries(data);
  if (entries.length === 0) return findById(tdb, id);

  const params = entries.map(([, value]) => value);
  const setClauses = entries.map(([column], index) => `${column} = $${index + 1}`);
  params.push(id);

  const { rows } = await tdb.query<RoughEstimateRow>(
    `UPDATE ${tdb.ref('rough_estimates')}
     SET ${setClauses.join(', ')}, updated_at = NOW()
     WHERE id = $${params.length}
     RETURNING *`,
    params,
  );

  return rows[0] ? mapEstimate(rows[0]) : null;
}

export async function findByProject(tdb: TenantDb, projectId: string): Promise<RoughEstimate[]> {
  const { rows } = await tdb.query<RoughEstimateRow>(
    `SELECT * FROM ${tdb.ref('rough_estimates')}
     WHERE project_id = $1
     ORDER BY created_at DESC`,
    [projectId],
  );

  return rows.map(mapEstimate);
}

export async function findById(tdb: TenantDb, id: string): Promise<RoughEstimate | null> {
  const { rows } = await tdb.query<RoughEstimateRow>(
    `SELECT * FROM ${tdb.ref('rough_estimates')} WHERE id = $1 LIMIT 1`,
    [id],
  );

  return rows[0] ? mapEstimate(rows[0]) : null;
}

export async function findByIdWithUnits(tdb: TenantDb, id: string): Promise<RoughEstimateWithUnits | null> {
  const estimate = await findById(tdb, id);
  if (!estimate) return null;

  const units = await findUnits(tdb, id);
  return { ...estimate, units };
}

export async function deleteById(tdb: TenantDb, id: string): Promise<boolean> {
  const { rowCount } = await tdb.query(
    `DELETE FROM ${tdb.ref('rough_estimates')} WHERE id = $1`,
    [id],
  );
  return rowCount > 0;
}

export async function findUnits(tdb: TenantDb, estimateId: string): Promise<RoughEstimateUnit[]> {
  const { rows } = await tdb.query<RoughEstimateUnitRow>(
    `SELECT * FROM ${tdb.ref('rough_estimate_units')}
     WHERE estimate_id = $1
     ORDER BY floor_number ASC, unit_number ASC, created_at ASC`,
    [estimateId],
  );

  return rows.map(mapUnit);
}

export async function upsertUnits(
  tdb: TenantDb,
  estimateId: string,
  units: RoughEstimateUnitPayload[],
): Promise<RoughEstimateUnit[]> {
  await tdb.query(`DELETE FROM ${tdb.ref('rough_estimate_units')} WHERE estimate_id = $1`, [estimateId]);

  if (units.length === 0) return [];

  const values: unknown[] = [];
  const placeholders = units.map((unit, rowIndex) => {
    const offset = rowIndex * 14;
    values.push(
      estimateId,
      unit.floorNumber,
      unit.floorLabel ?? null,
      unit.unitNumber,
      unit.block ?? null,
      unit.unitType ?? 'apartment',
      unit.ownerType ?? 'property_owner',
      unit.ownerName ?? null,
      unit.propertyOwnerId ?? null,
      unit.grossArea ?? null,
      unit.fireEscapeArea ?? 0,
      unit.hasPayment ?? true,
      unit.paymentAmount ?? null,
      unit.notes ?? null,
    );
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14})`;
  });

  const { rows } = await tdb.query<RoughEstimateUnitRow>(
    `INSERT INTO ${tdb.ref('rough_estimate_units')}
       (estimate_id, floor_number, floor_label, unit_number, block, unit_type, owner_type, owner_name, property_owner_id, gross_area, fire_escape_area, has_payment, payment_amount, notes)
     VALUES ${placeholders.join(', ')}
     RETURNING *`,
    values,
  );

  return rows.map(mapUnit);
}
