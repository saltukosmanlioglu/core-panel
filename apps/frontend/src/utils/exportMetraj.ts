import ExcelJS from 'exceljs';
import { calculateTakeoff } from '@core-panel/shared';
import type { FloorType, RoughConstruction } from '@core-panel/shared';
import { calculateSubcontractorMetraj } from './metrajSubcontractor';
import { calculateRoughConstructionSummary } from './roughConstruction';

const COLORS = {
  navy:    '1F2937',
  navyBg:  'E5E7EB',
  white:   'FFFFFF',
  gray50:  'F9FAFB',
  gray100: 'F3F4F6',
  gray400: '9CA3AF',
  blue50:  'EFF6FF',
  blue700: '1D4ED8',
};

const solidFill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const thin = (): Partial<ExcelJS.Borders> => ({
  top: { style: 'thin', color: { argb: 'E5E7EB' } },
  bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
  left: { style: 'thin', color: { argb: 'E5E7EB' } },
  right: { style: 'thin', color: { argb: 'E5E7EB' } },
});

export async function exportMetrajToExcel(
  projectName: string,
  floorTypes: FloorType[],
  roughConstruction?: RoughConstruction | null,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Core Panel';
  wb.created = new Date();

  const result = calculateTakeoff(floorTypes);

  // ── Sheet 1: Özet ──────────────────────────────────────────────────────────
  const ws = wb.addWorksheet('Metraj Özeti');
  ws.columns = [
    { key: 'label',        width: 24 },
    { key: 'qty',          width: 8  },
    { key: 'grossFloor',   width: 16 },
    { key: 'ceiling',      width: 16 },
    { key: 'grossWall',    width: 18 },
    { key: 'opening',      width: 14 },
    { key: 'netWall',      width: 16 },
    { key: 'skirting',     width: 16 },
  ];

  // Title
  ws.mergeCells('A1:H1');
  const title = ws.getCell('A1');
  title.value = `${projectName} — Metraj Özeti`;
  title.font = { bold: true, size: 13, color: { argb: COLORS.white } };
  title.fill = solidFill(COLORS.navy);
  title.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 32;

  // Date
  ws.mergeCells('A2:H2');
  const dateCell = ws.getCell('A2');
  dateCell.value = `Oluşturulma: ${new Date().toLocaleDateString('tr-TR')}`;
  dateCell.font = { size: 10, color: { argb: COLORS.gray400 } };
  dateCell.fill = solidFill(COLORS.gray100);
  dateCell.alignment = { indent: 1 };
  ws.getRow(2).height = 18;

  ws.addRow([]);

  // Column headers
  const headers = ['Kat Tipi', 'Adet', 'Brüt Alan (m²)', 'Tavan (m²)', 'Brüt Duvar (m²)', 'Boşluk (m²)', 'Net Duvar (m²)', 'Süpürgelik (m)'];
  const hRow = ws.addRow(headers);
  hRow.height = 22;
  hRow.eachCell(cell => {
    cell.font = { bold: true, size: 11, color: { argb: COLORS.white } };
    cell.fill = solidFill('374151');
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thin();
  });

  // Data rows
  result.floorTypes.forEach((ft, i) => {
    const row = ws.addRow([
      ft.label,
      `×${ft.quantity}`,
      ft.total.grossFloorArea,
      ft.total.ceilingArea,
      ft.total.grossWallArea,
      ft.total.openingArea,
      ft.total.netWallArea,
      ft.total.skirtingLinear,
    ]);
    row.height = 20;
    const bg = i % 2 === 0 ? COLORS.gray50 : COLORS.white;
    row.eachCell((cell, col) => {
      cell.fill = solidFill(bg);
      cell.border = thin();
      cell.alignment = { horizontal: col === 1 ? 'left' : 'right', vertical: 'middle', indent: col === 1 ? 1 : 0 };
      if (col > 2) cell.numFmt = '#,##0.00';
    });
  });

  // Totals row
  const { totals } = result;
  const totRow = ws.addRow(['Toplam', '', totals.grossFloorArea, totals.ceilingArea, totals.grossWallArea, totals.openingArea, totals.netWallArea, totals.skirtingLinear]);
  totRow.height = 24;
  totRow.eachCell((cell, col) => {
    cell.font = { bold: true, size: 11, color: { argb: COLORS.white } };
    cell.fill = solidFill(COLORS.navy);
    cell.border = thin();
    cell.alignment = { horizontal: col <= 2 ? 'left' : 'right', vertical: 'middle', indent: col === 1 ? 1 : 0 };
    if (col > 2) cell.numFmt = '#,##0.00';
  });

  // ── Sheet 2: Kat Detayları ─────────────────────────────────────────────────
  const ws2 = wb.addWorksheet('Kat Detayları');
  ws2.columns = [
    { key: 'col1', width: 22 },
    { key: 'col2', width: 14 },
    { key: 'col3', width: 14 },
    { key: 'col4', width: 14 },
    { key: 'col5', width: 14 },
    { key: 'col6', width: 14 },
  ];

  for (const ft of floorTypes) {
    // Floor type header
    const ftRow = ws2.addRow([`${ft.label}  ×${ft.quantity}`]);
    ws2.mergeCells(ftRow.number, 1, ftRow.number, 6);
    ftRow.height = 24;
    ftRow.getCell(1).font = { bold: true, size: 11, color: { argb: COLORS.white } };
    ftRow.getCell(1).fill = solidFill('374151');
    ftRow.getCell(1).alignment = { indent: 1, vertical: 'middle' };

    // Rooms sub-header
    if (ft.rooms.length > 0) {
      const rh = ws2.addRow(['Oda', 'Uzunluk', 'Genişlik', 'Tavan Yük.', 'Brüt Alan', 'Çevre']);
      rh.height = 18;
      rh.eachCell(cell => {
        cell.font = { bold: true, size: 10, color: { argb: COLORS.navy } };
        cell.fill = solidFill(COLORS.blue50);
        cell.border = thin();
        cell.alignment = { horizontal: 'center' };
      });
      rh.getCell(1).alignment = { horizontal: 'left', indent: 1 };

      ft.rooms.forEach(room => {
        const area = room.length * room.width;
        const perim = 2 * (room.length + room.width);
        const r = ws2.addRow([room.name, room.length, room.width, room.ceilingHeight, area, perim]);
        r.height = 18;
        r.eachCell((cell, col) => {
          cell.fill = solidFill(COLORS.white);
          cell.border = thin();
          cell.alignment = { horizontal: col === 1 ? 'left' : 'right', indent: col === 1 ? 1 : 0 };
          if (col > 1) cell.numFmt = '#,##0.00';
        });
      });
    }

    // Openings sub-header
    if (ft.openings.length > 0) {
      const oh = ws2.addRow(['Boşluk', 'Tür', 'Genişlik', 'Yükseklik', 'Adet', 'Alan (m²)']);
      oh.height = 18;
      oh.eachCell(cell => {
        cell.font = { bold: true, size: 10, color: { argb: COLORS.navy } };
        cell.fill = solidFill('FEF3C7');
        cell.border = thin();
        cell.alignment = { horizontal: 'center' };
      });
      oh.getCell(1).alignment = { horizontal: 'left', indent: 1 };

      const typeLabel: Record<string, string> = { door: 'Kapı', 'french-balcony': 'Fransız Balkon', window: 'Pencere', other: 'Diğer' };
      ft.openings.forEach(op => {
        const r = ws2.addRow([op.label, typeLabel[op.type] ?? op.type, op.width, op.height, op.quantity, op.width * op.height * op.quantity]);
        r.height = 18;
        r.eachCell((cell, col) => {
          cell.fill = solidFill(COLORS.white);
          cell.border = thin();
          cell.alignment = { horizontal: col <= 2 ? 'left' : 'right', indent: col <= 2 ? 1 : 0 };
          if (col > 2) cell.numFmt = '#,##0.00';
        });
      });
    }

    ws2.addRow([]);
  }

  // ── Sheet 3: Taşeron Metrajı ───────────────────────────────────────────────
  const ws3 = wb.addWorksheet('Taşeron Metrajı');
  ws3.columns = [
    { key: 'subcontractor', width: 18 },
    { key: 'item',          width: 28 },
    { key: 'unit',          width: 10 },
    { key: 'value',         width: 16 },
  ];

  ws3.mergeCells('A1:D1');
  const subcontractorTitle = ws3.getCell('A1');
  subcontractorTitle.value = `${projectName} — Taşeron Metrajı`;
  subcontractorTitle.font = { bold: true, size: 13, color: { argb: COLORS.white } };
  subcontractorTitle.fill = solidFill(COLORS.navy);
  subcontractorTitle.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  ws3.getRow(1).height = 32;

  ws3.addRow([]);

  const subcontractorHeader = ws3.addRow(['Taşeron', 'İş Kalemi', 'Birim', 'Miktar']);
  subcontractorHeader.height = 22;
  subcontractorHeader.eachCell(cell => {
    cell.font = { bold: true, size: 11, color: { argb: COLORS.white } };
    cell.fill = solidFill('374151');
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thin();
  });

  calculateSubcontractorMetraj(floorTypes).forEach((item, i) => {
    const row = ws3.addRow([item.subcontractor, item.item, item.unit, item.value]);
    row.height = 20;
    const bg = i % 2 === 0 ? COLORS.gray50 : COLORS.white;
    row.eachCell((cell, col) => {
      cell.fill = solidFill(bg);
      cell.border = thin();
      cell.alignment = { horizontal: col <= 2 ? 'left' : 'right', vertical: 'middle', indent: col <= 2 ? 1 : 0 };
      if (col === 4) cell.numFmt = item.unit === 'adet' ? '#,##0' : '#,##0.00';
    });
  });

  if (roughConstruction) {
    // ── Sheet 4: Kaba İnşaat Özeti ───────────────────────────────────────────
    const roughSummary = calculateRoughConstructionSummary(roughConstruction);
    const ws4 = wb.addWorksheet('Kaba İnşaat');
    ws4.columns = [
      { key: 'floor',         width: 18 },
      { key: 'element',       width: 22 },
      { key: 'quantity',      width: 16 },
      { key: 'concreteClass', width: 14 },
      { key: 'unitPrice',     width: 14 },
      { key: 'totalCost',     width: 16 },
    ];

    ws4.mergeCells('A1:F1');
    const roughTitle = ws4.getCell('A1');
    roughTitle.value = `${projectName} — Kaba İnşaat Özeti`;
    roughTitle.font = { bold: true, size: 13, color: { argb: COLORS.white } };
    roughTitle.fill = solidFill(COLORS.navy);
    roughTitle.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    ws4.getRow(1).height = 32;

    ws4.addRow([]);

    const roughHeader = ws4.addRow(['Kat Tipi', 'Eleman', 'Miktar (m³)', 'Beton Sınıfı', 'Birim Fiyat', 'Toplam Tutar']);
    roughHeader.height = 22;
    roughHeader.eachCell(cell => {
      cell.font = { bold: true, size: 11, color: { argb: COLORS.white } };
      cell.fill = solidFill('374151');
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thin();
    });

    roughSummary.rows.forEach((item, i) => {
      const row = ws4.addRow([
        item.floorLabel,
        item.elementLabel,
        item.quantityM3,
        item.concreteClass,
        item.unitPrice,
        item.totalCost,
      ]);
      row.height = 20;
      const bg = i % 2 === 0 ? COLORS.gray50 : COLORS.white;
      row.eachCell((cell, col) => {
        cell.fill = solidFill(bg);
        cell.border = thin();
        cell.alignment = { horizontal: col <= 2 ? 'left' : 'right', vertical: 'middle', indent: col <= 2 ? 1 : 0 };
        if (col === 3) cell.numFmt = '#,##0.000';
        if (col === 5 || col === 6) cell.numFmt = '#,##0.00';
      });
    });

    ws4.addRow([]);

    roughSummary.classTotals.forEach(total => {
      const row = ws4.addRow([`${total.concreteClass} toplam m³`, '', total.quantityM3, total.concreteClass, '', total.totalCost]);
      row.height = 20;
      row.eachCell((cell, col) => {
        cell.font = { bold: true, size: 11, color: { argb: COLORS.navy } };
        cell.fill = solidFill(COLORS.gray100);
        cell.border = thin();
        cell.alignment = { horizontal: col <= 2 ? 'left' : 'right', vertical: 'middle', indent: col === 1 ? 1 : 0 };
        if (col === 3) cell.numFmt = '#,##0.000';
        if (col === 6) cell.numFmt = '#,##0.00';
      });
    });

    const roughTotal = ws4.addRow(['Genel Toplam', '', roughSummary.grandTotalM3, '', '', roughSummary.grandTotalCost]);
    roughTotal.height = 24;
    roughTotal.eachCell((cell, col) => {
      cell.font = { bold: true, size: 11, color: { argb: COLORS.white } };
      cell.fill = solidFill(COLORS.navy);
      cell.border = thin();
      cell.alignment = { horizontal: col <= 2 ? 'left' : 'right', vertical: 'middle', indent: col === 1 ? 1 : 0 };
      if (col === 3) cell.numFmt = '#,##0.000';
      if (col === 6) cell.numFmt = '#,##0.00';
    });
  }

  // Trigger download
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `metraj-${projectName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
