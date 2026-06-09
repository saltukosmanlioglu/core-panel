import type {
  ConcreteClass,
  RoughBeamInput,
  RoughColumnInput,
  RoughConstruction,
  RoughConstructionFloorType,
} from '@core-panel/shared';

export const CONCRETE_CLASSES: ConcreteClass[] = ['C20', 'C25', 'C30', 'C35', 'C40', 'C45'];

export type RoughElementType = 'slab' | 'basement-wall' | 'column' | 'beam';

export interface RoughSummaryRow {
  id: string;
  floorTypeId: string;
  elementType: RoughElementType;
  elementId: string;
  floorLabel: string;
  elementLabel: string;
  quantityM3: number;
  concreteClass: ConcreteClass;
  unitPrice: number;
  totalCost: number;
}

export interface RoughConcreteClassTotal {
  concreteClass: ConcreteClass;
  quantityM3: number;
  totalCost: number;
}

export interface RoughSummary {
  rows: RoughSummaryRow[];
  classTotals: RoughConcreteClassTotal[];
  grandTotalM3: number;
  grandTotalCost: number;
}

const n = (value: number): number => (Number.isFinite(value) ? value : 0);
const r3 = (value: number): number => Math.round(value * 1000) / 1000;
const r2 = (value: number): number => Math.round(value * 100) / 100;

type LegacyRoughColumnInput = Partial<RoughColumnInput> & {
  id?: string;
  label?: string;
  freeHeightM?: number;
  applyMode?: string;
  applyUntilFloor?: number;
};

type PersistedRoughFloorType = Partial<RoughConstructionFloorType> & {
  key?: RoughConstructionFloorType['key'];
  columns?: LegacyRoughColumnInput[];
  column?: LegacyRoughColumnInput;
};

function newColumn(concreteClass: ConcreteClass): RoughColumnInput {
  return {
    widthM: 0,
    depthM: 0,
    quantity: 0,
    concreteClass,
    unitPrice: 0,
  };
}

function newFloorType(
  key: RoughConstructionFloorType['key'],
  label: string,
  quantity: number,
  footprintArea: number,
  concreteClass: ConcreteClass,
): RoughConstructionFloorType {
  return {
    id: key,
    key,
    label,
    quantity,
    ceilingHeightM: 0,
    slab: {
      areaSqm: footprintArea,
      thicknessM: 0,
      concreteClass,
      unitPrice: 0,
    },
    basementWall: key === 'basement'
      ? { perimeterM: 0, thicknessM: 0, heightM: 0, concreteClass: 'C35', unitPrice: 0 }
      : undefined,
    column: newColumn(concreteClass),
    beams: [],
  };
}

export function createDefaultRoughConstruction(
  footprintArea: number | null | undefined,
  floorCount: number | null | undefined,
): RoughConstruction {
  const area = n(footprintArea ?? 0);
  const upperFloorCount = Math.max(1, (floorCount ?? 2) - 1);

  return {
    floorTypes: [
      newFloorType('basement', 'Bodrum', 1, area, 'C35'),
      newFloorType('ground', 'Zemin Kat', 1, area, 'C30'),
      newFloorType('upper', 'Üst Katlar', upperFloorCount, area, 'C30'),
    ],
  };
}

export function createRoughBeam(label: string, concreteClass: ConcreteClass): RoughBeamInput {
  return {
    id: crypto.randomUUID(),
    label,
    widthM: 0,
    heightM: 0,
    totalLengthM: 0,
    concreteClass,
    unitPrice: 0,
  };
}

function normalizeColumn(
  column: LegacyRoughColumnInput | undefined,
  fallback: RoughColumnInput,
): RoughColumnInput {
  return {
    widthM: n(column?.widthM ?? fallback.widthM),
    depthM: n(column?.depthM ?? fallback.depthM),
    quantity: n(column?.quantity ?? fallback.quantity),
    concreteClass: column?.concreteClass ?? fallback.concreteClass,
    unitPrice: n(column?.unitPrice ?? fallback.unitPrice),
  };
}

export function normalizeRoughConstruction(
  roughConstruction: RoughConstruction | null | undefined,
  footprintArea: number | null | undefined,
  floorCount: number | null | undefined,
): RoughConstruction {
  const defaults = createDefaultRoughConstruction(footprintArea, floorCount);
  const persistedFloors = Array.isArray(roughConstruction?.floorTypes)
    ? (roughConstruction.floorTypes as PersistedRoughFloorType[])
    : [];

  if (persistedFloors.length === 0) return defaults;

  return {
    floorTypes: defaults.floorTypes.map(defaultFloor => {
      const persisted = persistedFloors.find(item => item.key === defaultFloor.key || item.id === defaultFloor.id);
      if (!persisted) return defaultFloor;

      const persistedColumn = persisted.column ?? persisted.columns?.[0];
      const quantity = defaultFloor.key === 'ground'
        ? 1
        : n(persisted.quantity ?? defaultFloor.quantity);

      return {
        id: persisted.id ?? defaultFloor.id,
        key: persisted.key ?? defaultFloor.key,
        label: persisted.label ?? defaultFloor.label,
        quantity,
        ceilingHeightM: n(persisted.ceilingHeightM ?? persistedColumn?.freeHeightM ?? defaultFloor.ceilingHeightM),
        slab: {
          ...defaultFloor.slab,
          ...(persisted.slab ?? {}),
        },
        basementWall: defaultFloor.key === 'basement'
          ? {
              ...defaultFloor.basementWall!,
              ...(persisted.basementWall ?? {}),
            }
          : undefined,
        column: normalizeColumn(persistedColumn, defaultFloor.column),
        beams: Array.isArray(persisted.beams) ? persisted.beams : defaultFloor.beams,
      };
    }),
  };
}

function rowTotal(quantityM3: number, unitPrice: number): number {
  return r2(quantityM3 * unitPrice);
}

export function calculateRoughConstructionSummary(roughConstruction: RoughConstruction | null | undefined): RoughSummary {
  const rows: RoughSummaryRow[] = [];

  for (const floorType of roughConstruction?.floorTypes ?? []) {
    const slabQuantity = r3(n(floorType.slab.areaSqm) * n(floorType.slab.thicknessM) * floorType.quantity);
    rows.push({
      id: `${floorType.id}:slab`,
      floorTypeId: floorType.id,
      elementType: 'slab',
      elementId: 'slab',
      floorLabel: floorType.label,
      elementLabel: 'Döşeme',
      quantityM3: slabQuantity,
      concreteClass: floorType.slab.concreteClass,
      unitPrice: floorType.slab.unitPrice,
      totalCost: rowTotal(slabQuantity, floorType.slab.unitPrice),
    });

    if (floorType.key === 'basement' && floorType.basementWall) {
      const wall = floorType.basementWall;
      const wallQuantity = r3(n(wall.perimeterM) * n(wall.thicknessM) * n(wall.heightM) * floorType.quantity);
      rows.push({
        id: `${floorType.id}:basement-wall`,
        floorTypeId: floorType.id,
        elementType: 'basement-wall',
        elementId: 'basement-wall',
        floorLabel: floorType.label,
        elementLabel: 'Perde Beton',
        quantityM3: wallQuantity,
        concreteClass: wall.concreteClass,
        unitPrice: wall.unitPrice,
        totalCost: rowTotal(wallQuantity, wall.unitPrice),
      });
    }

    const column = floorType.column;
    const columnQuantity = r3(
      n(column.widthM) * n(column.depthM) * n(floorType.ceilingHeightM) * n(column.quantity) * floorType.quantity,
    );
    rows.push({
      id: `${floorType.id}:column`,
      floorTypeId: floorType.id,
      elementType: 'column',
      elementId: 'column',
      floorLabel: floorType.label,
      elementLabel: 'Kolon',
      quantityM3: columnQuantity,
      concreteClass: column.concreteClass,
      unitPrice: column.unitPrice,
      totalCost: rowTotal(columnQuantity, column.unitPrice),
    });

    floorType.beams.forEach((beam, index) => {
      const quantityM3 = r3(n(beam.widthM) * n(beam.heightM) * n(beam.totalLengthM) * floorType.quantity);
      rows.push({
        id: `${floorType.id}:beam:${beam.id}`,
        floorTypeId: floorType.id,
        elementType: 'beam',
        elementId: beam.id,
        floorLabel: floorType.label,
        elementLabel: beam.label || `Kiriş ${index + 1}`,
        quantityM3,
        concreteClass: beam.concreteClass,
        unitPrice: beam.unitPrice,
        totalCost: rowTotal(quantityM3, beam.unitPrice),
      });
    });
  }

  const classTotals = CONCRETE_CLASSES
    .map(concreteClass => {
      const matchingRows = rows.filter(row => row.concreteClass === concreteClass);
      return {
        concreteClass,
        quantityM3: r3(matchingRows.reduce((sum, row) => sum + row.quantityM3, 0)),
        totalCost: r2(matchingRows.reduce((sum, row) => sum + row.totalCost, 0)),
      };
    })
    .filter(total => total.quantityM3 > 0 || total.totalCost > 0);

  return {
    rows,
    classTotals,
    grandTotalM3: r3(rows.reduce((sum, row) => sum + row.quantityM3, 0)),
    grandTotalCost: r2(rows.reduce((sum, row) => sum + row.totalCost, 0)),
  };
}
