import { calculateTakeoff } from '@core-panel/shared';
import type { FloorType, OpeningType } from '@core-panel/shared';

export interface SubcontractorMetrajRow {
  subcontractor: string;
  item: string;
  unit: 'm²' | 'mt' | 'adet';
  value: number;
}

function countOpenings(floorTypes: FloorType[], type: OpeningType): number {
  return floorTypes.reduce(
    (sum, ft) => sum + ft.quantity * ft.openings
      .filter(opening => opening.type === type)
      .reduce((openingSum, opening) => openingSum + opening.quantity, 0),
    0,
  );
}

export function calculateSubcontractorMetraj(floorTypes: FloorType[]): SubcontractorMetrajRow[] {
  const { totals } = calculateTakeoff(floorTypes);
  const doorCount = countOpenings(floorTypes, 'door');
  const windowCount = countOpenings(floorTypes, 'window');

  return [
    { subcontractor: 'Sıvacı', item: 'Net Duvar Sıvası', unit: 'm²', value: totals.netWallArea },
    { subcontractor: 'Sıvacı', item: 'Tavan Sıvası', unit: 'm²', value: totals.ceilingArea },
    { subcontractor: 'Boyacı', item: 'Net Duvar Boyası', unit: 'm²', value: totals.netWallArea },
    { subcontractor: 'Boyacı', item: 'Tavan Boyası', unit: 'm²', value: totals.ceilingArea },
    { subcontractor: 'Döşemeci', item: 'Toplam Döşeme Alanı', unit: 'm²', value: totals.grossFloorArea },
    { subcontractor: 'Süpürgelikçi', item: 'Süpürgelik', unit: 'mt', value: totals.skirtingLinear },
    { subcontractor: 'Doğramacı', item: 'Toplam Açıklık Alanı', unit: 'm²', value: totals.openingArea },
    { subcontractor: 'Doğramacı', item: 'Toplam Kapı Adedi', unit: 'adet', value: doorCount },
    { subcontractor: 'Doğramacı', item: 'Toplam Pencere Adedi', unit: 'adet', value: windowCount },
  ];
}

export function formatSubcontractorValue(value: number, unit: SubcontractorMetrajRow['unit']): string {
  return unit === 'adet' ? String(value) : value.toFixed(2);
}
