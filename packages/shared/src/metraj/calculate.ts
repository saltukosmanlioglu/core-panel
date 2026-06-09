import type {
  FloorType,
  FloorTypeResult,
  FloorTypeUnitResult,
  RoomResult,
  TakeoffResult,
  TakeoffTotals,
} from '../types/metraj';

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function calcUnit(ft: FloorType): FloorTypeUnitResult {
  const rooms: RoomResult[] = ft.rooms.map(room => ({
    roomId: room.id,
    grossArea: r2(room.length * room.width),
    perimeter: r2(2 * (room.length + room.width)),
    grossWallArea: r2(2 * (room.length + room.width) * room.ceilingHeight),
  }));

  const grossFloorArea = r2(rooms.reduce((s, r) => s + r.grossArea, 0));
  const grossWallArea = r2(rooms.reduce((s, r) => s + r.grossWallArea, 0));

  const openingArea = r2(
    ft.openings.reduce((s, o) => s + o.width * o.height * o.quantity, 0),
  );

  // Skirting: full perimeter minus door and french-balcony widths
  const rawSkirting = rooms.reduce((s, r) => s + r.perimeter, 0);
  const skirtingDeduction = ft.openings
    .filter(o => o.type === 'door' || o.type === 'french-balcony')
    .reduce((s, o) => s + o.width * o.quantity, 0);

  return {
    grossFloorArea,
    ceilingArea: grossFloorArea,
    grossWallArea,
    openingArea,
    netWallArea: r2(Math.max(0, grossWallArea - openingArea)),
    skirtingLinear: r2(Math.max(0, rawSkirting - skirtingDeduction)),
    rooms,
  };
}

function scale(unit: FloorTypeUnitResult, q: number): FloorTypeUnitResult {
  return {
    grossFloorArea: r2(unit.grossFloorArea * q),
    ceilingArea: r2(unit.ceilingArea * q),
    grossWallArea: r2(unit.grossWallArea * q),
    openingArea: r2(unit.openingArea * q),
    netWallArea: r2(unit.netWallArea * q),
    skirtingLinear: r2(unit.skirtingLinear * q),
    rooms: unit.rooms.map(r => ({
      ...r,
      grossArea: r2(r.grossArea * q),
      grossWallArea: r2(r.grossWallArea * q),
    })),
  };
}

const ZERO_TOTALS: TakeoffTotals = {
  grossFloorArea: 0,
  ceilingArea: 0,
  grossWallArea: 0,
  openingArea: 0,
  netWallArea: 0,
  skirtingLinear: 0,
};

export function calculateTakeoff(floorTypes: FloorType[]): TakeoffResult {
  const ftResults: FloorTypeResult[] = floorTypes.map(ft => {
    const perUnit = calcUnit(ft);
    return { floorTypeId: ft.id, label: ft.label, quantity: ft.quantity, perUnit, total: scale(perUnit, ft.quantity) };
  });

  const totals = ftResults.reduce<TakeoffTotals>(
    (acc, ft) => ({
      grossFloorArea: r2(acc.grossFloorArea + ft.total.grossFloorArea),
      ceilingArea: r2(acc.ceilingArea + ft.total.ceilingArea),
      grossWallArea: r2(acc.grossWallArea + ft.total.grossWallArea),
      openingArea: r2(acc.openingArea + ft.total.openingArea),
      netWallArea: r2(acc.netWallArea + ft.total.netWallArea),
      skirtingLinear: r2(acc.skirtingLinear + ft.total.skirtingLinear),
    }),
    { ...ZERO_TOTALS },
  );

  return { floorTypes: ftResults, totals };
}
