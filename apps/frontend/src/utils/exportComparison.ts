import ExcelJS from 'exceljs';
import type { ComparisonResult } from '@core-panel/shared';

interface ComparisonExportData {
  tenderTitle: string;
  projectName: string;
  categoryName: string;
  companyName: string;
  result: ComparisonResult;
}

const COLORS = {
  navyDark:    '0F2744',
  navy:        '1E3A5F',
  navyLight:   '2D5F8F',
  navyPale:    'E8F0F7',
  white:       'FFFFFF',
  offWhite:    'FAFAFA',
  gray100:     'F1F5F9',
  gray200:     'E2E8F0',
  gray400:     '94A3B8',
  gray600:     '475569',
  gray900:     '0F172A',
  greenBg:     'DCFCE7',
  greenText:   '16A34A',
  redBg:       'FEE2E2',
  redText:     'DC2626',
  orangeLight: 'FFF7ED',
  orangeText:  'C2410C',
  orangeBorder:'EA580C',
  headerText:  'FFFFFF',
};

const TENANT_COLORS = ['1D4ED8', '7C3AED', '0F766E', 'B45309', 'BE185D'];
const CURRENCY_FORMAT = '#,##0.00 ₺';

type ComparisonRowWithDiffs = ComparisonResult['rows'][number] & {
  priceDiffAmount?: number | null;
  priceDiffPercent?: number | null;
};

const solidFill = (color: string): ExcelJS.Fill => ({
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: color },
});

const thinBorder = (color = COLORS.gray200): Partial<ExcelJS.Borders> => ({
  top: { style: 'thin', color: { argb: color } },
  bottom: { style: 'thin', color: { argb: color } },
  left: { style: 'thin', color: { argb: color } },
  right: { style: 'thin', color: { argb: color } },
});

const mediumBorder = (color = COLORS.orangeBorder): Partial<ExcelJS.Borders> => ({
  top: { style: 'medium', color: { argb: color } },
  bottom: { style: 'medium', color: { argb: color } },
  left: { style: 'medium', color: { argb: color } },
  right: { style: 'medium', color: { argb: color } },
});

function mergeRowCells(ws: ExcelJS.Worksheet, rowIndex: number, startColumn: number, endColumn: number): ExcelJS.Cell {
  if (startColumn < endColumn) {
    ws.mergeCells(rowIndex, startColumn, rowIndex, endColumn);
  }

  return ws.getCell(rowIndex, startColumn);
}

function styleRowRange(
  ws: ExcelJS.Worksheet,
  rowIndex: number,
  startColumn: number,
  endColumn: number,
  style: Partial<ExcelJS.Style>,
): void {
  for (let columnIndex = startColumn; columnIndex <= endColumn; columnIndex++) {
    const cell = ws.getCell(rowIndex, columnIndex);
    if (style.fill) cell.fill = style.fill;
    if (style.font) cell.font = style.font;
    if (style.alignment) cell.alignment = style.alignment;
    if (style.border) cell.border = style.border;
    if (style.numFmt) cell.numFmt = style.numFmt;
  }
}

function setMergedValue(
  ws: ExcelJS.Worksheet,
  rowIndex: number,
  startColumn: number,
  endColumn: number,
  value: ExcelJS.CellValue,
  style: Partial<ExcelJS.Style>,
): ExcelJS.Cell {
  const cell = mergeRowCells(ws, rowIndex, startColumn, endColumn);
  cell.value = value;
  styleRowRange(ws, rowIndex, startColumn, endColumn, style);
  return cell;
}

function formatCurrency(value: number): string {
  return `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

function getRowDiff(row: ComparisonRowWithDiffs, tenantIds: string[]): { amount: number | null; percent: number | null } {
  const offeredTotals = tenantIds
    .map((tenantId) => row.prices[tenantId]?.tutar)
    .filter((value): value is number => typeof value === 'number' && value > 0);

  if (typeof row.priceDiffAmount === 'number' || typeof row.priceDiffPercent === 'number') {
    return {
      amount: typeof row.priceDiffAmount === 'number' ? row.priceDiffAmount : null,
      percent: typeof row.priceDiffPercent === 'number' ? row.priceDiffPercent : null,
    };
  }

  if (offeredTotals.length < 2) {
    return { amount: null, percent: null };
  }

  const minimum = Math.min(...offeredTotals);
  const maximum = Math.max(...offeredTotals);
  const amount = maximum - minimum;

  return {
    amount,
    percent: minimum > 0 ? (amount / minimum) * 100 : null,
  };
}

function setCurrencyCell(cell: ExcelJS.Cell, value: number | null | undefined, rowBg: string): void {
  cell.value = value ?? '—';
  cell.fill = solidFill(rowBg);
  cell.font = { name: 'Calibri', size: 9, color: { argb: COLORS.gray900 } };
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
  cell.border = thinBorder();

  if (typeof value === 'number') {
    cell.numFmt = CURRENCY_FORMAT;
  }
}

export const exportComparison = async (data: ComparisonExportData): Promise<void> => {
  const wb = new ExcelJS.Workbook();
  wb.creator = data.companyName;
  wb.created = new Date();

  const ws = wb.addWorksheet('Teklif Karşılaştırma');

  const tenantEntries = Object.entries(data.result.tenantNames)
    .sort((left, right) => left[1].localeCompare(right[1], 'tr'));
  const tenantIds = tenantEntries.map(([tenantId]) => tenantId);
  const totalColumns = 3 + tenantEntries.length * 3 + 2;
  const today = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  ws.columns = [
    { key: 'rowNo', width: 5 },
    { key: 'description', width: 40 },
    { key: 'unit', width: 10 },
    ...tenantEntries.flatMap(([tenantId]) => [
      { key: `${tenantId}_material`, width: 14 },
      { key: `${tenantId}_labor`, width: 14 },
      { key: `${tenantId}_total`, width: 16 },
    ]),
    { key: 'diffAmount', width: 14 },
    { key: 'diffPercent', width: 10 },
  ];

  let currentRow = 1;

  setMergedValue(ws, currentRow, 1, totalColumns, null, {
    fill: solidFill(COLORS.navyDark),
  });
  ws.getRow(currentRow).height = 6;
  currentRow++;

  setMergedValue(ws, currentRow, 1, totalColumns, data.companyName.toUpperCase(), {
    fill: solidFill(COLORS.navyDark),
    font: { name: 'Calibri', bold: true, size: 18, color: { argb: COLORS.headerText } },
    alignment: { vertical: 'middle', horizontal: 'center' },
  });
  ws.getRow(currentRow).height = 38;
  currentRow++;

  setMergedValue(ws, currentRow, 1, totalColumns, 'Güven  •  Kalite  •  Sürdürülebilirlik', {
    fill: solidFill(COLORS.navyDark),
    font: { name: 'Calibri', size: 9, italic: true, color: { argb: 'B8D4EC' } },
    alignment: { vertical: 'middle', horizontal: 'center' },
  });
  ws.getRow(currentRow).height = 16;
  currentRow++;

  setMergedValue(ws, currentRow, 1, totalColumns - 2, 'TEKLİF KARŞILAŞTIRMA RAPORU', {
    fill: solidFill(COLORS.navyPale),
    font: { name: 'Calibri', bold: true, size: 13, color: { argb: COLORS.navy } },
    alignment: { vertical: 'middle', horizontal: 'left', indent: 1 },
  });
  setMergedValue(ws, currentRow, totalColumns - 1, totalColumns, today, {
    fill: solidFill(COLORS.navyPale),
    font: { name: 'Calibri', size: 9, color: { argb: COLORS.gray600 } },
    alignment: { vertical: 'middle', horizontal: 'right', indent: 1 },
  });
  ws.getRow(currentRow).height = 22;
  currentRow++;

  setMergedValue(ws, currentRow, 1, totalColumns, null, {
    fill: solidFill(COLORS.navyLight),
  });
  ws.getRow(currentRow).height = 3;
  currentRow++;

  ws.getRow(currentRow).height = 8;
  currentRow++;

  const middleColumn = Math.ceil(totalColumns / 2);
  const infoRows: Array<[string, string, string, string]> = [
    ['İhale Adı', data.tenderTitle, 'Kategori', data.categoryName],
    ['Proje', data.projectName, 'Tarih', today],
  ];

  for (const [leftLabel, leftValue, rightLabel, rightValue] of infoRows) {
    setMergedValue(ws, currentRow, 1, 2, leftLabel, {
      fill: solidFill(COLORS.gray100),
      font: { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.gray600 } },
      alignment: { vertical: 'middle', horizontal: 'left', indent: 1 },
      border: { bottom: { style: 'thin', color: { argb: COLORS.gray200 } } },
    });
    setMergedValue(ws, currentRow, 3, middleColumn, leftValue, {
      fill: solidFill(COLORS.white),
      font: { name: 'Calibri', size: 10, color: { argb: COLORS.gray900 } },
      alignment: { vertical: 'middle', horizontal: 'left', indent: 1 },
      border: { bottom: { style: 'thin', color: { argb: COLORS.gray200 } } },
    });
    setMergedValue(ws, currentRow, middleColumn + 1, middleColumn + 2, rightLabel, {
      fill: solidFill(COLORS.gray100),
      font: { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.gray600 } },
      alignment: { vertical: 'middle', horizontal: 'left', indent: 1 },
      border: { bottom: { style: 'thin', color: { argb: COLORS.gray200 } } },
    });
    setMergedValue(ws, currentRow, middleColumn + 3, totalColumns, rightValue, {
      fill: solidFill(COLORS.white),
      font: { name: 'Calibri', size: 10, color: { argb: COLORS.gray900 } },
      alignment: { vertical: 'middle', horizontal: 'left', indent: 1 },
      border: { bottom: { style: 'thin', color: { argb: COLORS.gray200 } } },
    });
    ws.getRow(currentRow).height = 22;
    currentRow++;
  }

  ws.getRow(currentRow).height = 8;
  currentRow++;

  const cheapestTenantName = data.result.cheapestTenantId
    ? (data.result.tenantNames[data.result.cheapestTenantId] ?? '—')
    : '—';
  const summaryValues = [
    `Potansiyel Tasarruf: ${formatCurrency(data.result.summary.potentialSavings)}`,
    `Minimum Toplam: ${formatCurrency(data.result.summary.minimumPossibleTotal)}`,
    `En Avantajlı Firma: ${cheapestTenantName}`,
  ];

  summaryValues.forEach((value, index) => {
    const summaryStartColumn = Math.floor((index * totalColumns) / summaryValues.length) + 1;
    const summaryEndColumn = Math.floor(((index + 1) * totalColumns) / summaryValues.length);
    setMergedValue(ws, currentRow, summaryStartColumn, summaryEndColumn, value, {
      fill: solidFill(COLORS.navyPale),
      font: { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.navy } },
      alignment: { vertical: 'middle', horizontal: 'center' },
      border: thinBorder(COLORS.white),
    });
  });
  ws.getRow(currentRow).height = 24;
  currentRow++;

  ws.getRow(currentRow).height = 8;
  currentRow++;

  const groupHeaderRowIndex = currentRow;
  styleRowRange(ws, groupHeaderRowIndex, 1, 3, {
    fill: solidFill(COLORS.navy),
    font: { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.headerText } },
    alignment: { vertical: 'middle', horizontal: 'center' },
    border: thinBorder(COLORS.white),
  });

  let tenantStartColumn = 4;
  tenantEntries.forEach(([, tenantName], index) => {
    const tenantEndColumn = tenantStartColumn + 2;
    setMergedValue(ws, groupHeaderRowIndex, tenantStartColumn, tenantEndColumn, tenantName, {
      fill: solidFill(TENANT_COLORS[index % TENANT_COLORS.length]),
      font: { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.headerText } },
      alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
      border: thinBorder(COLORS.white),
    });
    tenantStartColumn = tenantEndColumn + 1;
  });

  setMergedValue(ws, groupHeaderRowIndex, totalColumns - 1, totalColumns, 'Fark', {
    fill: solidFill(COLORS.gray600),
    font: { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.headerText } },
    alignment: { vertical: 'middle', horizontal: 'center' },
    border: thinBorder(COLORS.white),
  });
  ws.getRow(groupHeaderRowIndex).height = 24;
  currentRow++;

  const subHeaderRowIndex = currentRow;
  const subHeaders = [
    '#',
    'Tanım',
    'Birim',
    ...tenantEntries.flatMap(() => ['Malzeme', 'İşçilik', 'Tutar']),
    'Fark (TL)',
    'Fark (%)',
  ];

  subHeaders.forEach((header, index) => {
    const cell = ws.getCell(subHeaderRowIndex, index + 1);
    cell.value = header;
    cell.fill = solidFill(COLORS.navy);
    cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.headerText } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder(COLORS.white);
  });
  ws.getRow(subHeaderRowIndex).height = 28;
  currentRow++;

  for (const row of data.result.rows as ComparisonRowWithDiffs[]) {
    const rowBg = (currentRow - subHeaderRowIndex) % 2 === 1 ? COLORS.white : COLORS.offWhite;

    const rowNumberCell = ws.getCell(currentRow, 1);
    rowNumberCell.value = row.siraNo;
    rowNumberCell.fill = solidFill(rowBg);
    rowNumberCell.font = { name: 'Calibri', size: 9, color: { argb: COLORS.gray600 } };
    rowNumberCell.alignment = { vertical: 'middle', horizontal: 'center' };
    rowNumberCell.border = thinBorder();

    const descriptionCell = ws.getCell(currentRow, 2);
    descriptionCell.value = row.description;
    descriptionCell.fill = solidFill(rowBg);
    descriptionCell.font = { name: 'Calibri', size: 9, color: { argb: COLORS.gray900 } };
    descriptionCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    descriptionCell.border = thinBorder();

    const unitCell = ws.getCell(currentRow, 3);
    unitCell.value = row.unit;
    unitCell.fill = solidFill(rowBg);
    unitCell.font = { name: 'Calibri', size: 9, color: { argb: COLORS.gray600 } };
    unitCell.alignment = { vertical: 'middle', horizontal: 'center' };
    unitCell.border = thinBorder();

    let priceColumn = 4;
    tenantIds.forEach((tenantId) => {
      const price = row.prices[tenantId];
      setCurrencyCell(ws.getCell(currentRow, priceColumn), price?.malzemeBirimFiyat, rowBg);
      setCurrencyCell(ws.getCell(currentRow, priceColumn + 1), price?.isciliikBirimFiyat, rowBg);

      const totalCell = ws.getCell(currentRow, priceColumn + 2);
      totalCell.value = price?.tutar ?? '—';
      totalCell.numFmt = typeof price?.tutar === 'number' ? CURRENCY_FORMAT : '';
      totalCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.gray900 } };
      totalCell.alignment = { vertical: 'middle', horizontal: 'center' };
      totalCell.border = thinBorder();

      if (price?.isCheapest) {
        totalCell.fill = solidFill(COLORS.greenBg);
        totalCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.greenText } };
      } else if (price?.isMostExpensive) {
        totalCell.fill = solidFill(COLORS.redBg);
        totalCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.redText } };
      } else {
        totalCell.fill = solidFill(rowBg);
      }

      priceColumn += 3;
    });

    const rowDiff = getRowDiff(row, tenantIds);
    const diffAmountCell = ws.getCell(currentRow, totalColumns - 1);
    diffAmountCell.value = rowDiff.amount ?? '—';
    diffAmountCell.fill = solidFill(rowBg);
    diffAmountCell.font = { name: 'Calibri', size: 9, color: { argb: COLORS.orangeText } };
    diffAmountCell.alignment = { vertical: 'middle', horizontal: 'center' };
    diffAmountCell.border = thinBorder();
    if (typeof rowDiff.amount === 'number') {
      diffAmountCell.numFmt = CURRENCY_FORMAT;
    }

    const diffPercentCell = ws.getCell(currentRow, totalColumns);
    diffPercentCell.value = rowDiff.percent ? `%${rowDiff.percent.toFixed(1)}` : '—';
    diffPercentCell.fill = solidFill(rowBg);
    diffPercentCell.font = { name: 'Calibri', size: 9, color: { argb: COLORS.orangeText } };
    diffPercentCell.alignment = { vertical: 'middle', horizontal: 'center' };
    diffPercentCell.border = thinBorder();

    ws.getRow(currentRow).height = Math.max(18, Math.ceil(row.description.length / 45) * 14);
    currentRow++;
  }

  const totals = tenantIds
    .map((tenantId) => data.result.totals[tenantId])
    .filter((value): value is number => typeof value === 'number' && value > 0);
  const minTotal = totals.length > 0 ? Math.min(...totals) : null;
  const maxTotal = totals.length > 0 ? Math.max(...totals) : null;

  setMergedValue(ws, currentRow, 1, 3, 'TOPLAM', {
    fill: solidFill(COLORS.orangeLight),
    font: { name: 'Calibri', size: 11, bold: true, color: { argb: COLORS.orangeText } },
    alignment: { vertical: 'middle', horizontal: 'center' },
    border: mediumBorder(),
  });

  let totalColumn = 4;
  tenantIds.forEach((tenantId) => {
    styleRowRange(ws, currentRow, totalColumn, totalColumn + 1, {
      fill: solidFill(COLORS.orangeLight),
      border: mediumBorder(),
    });

    const total = data.result.totals[tenantId];
    const totalCell = ws.getCell(currentRow, totalColumn + 2);
    totalCell.value = total ?? '—';
    totalCell.numFmt = typeof total === 'number' ? CURRENCY_FORMAT : '';
    totalCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLORS.orangeText } };
    totalCell.alignment = { vertical: 'middle', horizontal: 'center' };
    totalCell.border = mediumBorder();

    if (typeof total === 'number' && total === minTotal) {
      totalCell.fill = solidFill(COLORS.greenBg);
      totalCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLORS.greenText } };
    } else if (typeof total === 'number' && total === maxTotal) {
      totalCell.fill = solidFill(COLORS.redBg);
      totalCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLORS.redText } };
    } else {
      totalCell.fill = solidFill(COLORS.orangeLight);
    }

    totalColumn += 3;
  });

  styleRowRange(ws, currentRow, totalColumns - 1, totalColumns, {
    fill: solidFill(COLORS.orangeLight),
    border: mediumBorder(),
  });
  ws.getRow(currentRow).height = 28;
  currentRow++;

  ws.getRow(currentRow).height = 8;
  currentRow++;

  setMergedValue(ws, currentRow, 1, totalColumns, `Bu rapor ${data.companyName} tarafından ${today} tarihinde oluşturulmuştur.`, {
    fill: solidFill(COLORS.gray100),
    font: { name: 'Calibri', size: 9, italic: true, color: { argb: COLORS.gray600 } },
    alignment: { vertical: 'middle', horizontal: 'center' },
    border: thinBorder(),
  });
  ws.getRow(currentRow).height = 18;

  ws.views = [{
    state: 'frozen',
    xSplit: 3,
    ySplit: subHeaderRowIndex,
    activeCell: 'D1',
  } as Partial<ExcelJS.WorksheetView> & { activeCell: string }];

  ws.pageSetup.orientation = 'landscape';
  ws.pageSetup.fitToPage = true;
  ws.pageSetup.fitToWidth = 1;
  ws.pageSetup.paperSize = 9;
  ws.pageSetup.printTitlesRow = `${subHeaderRowIndex}:${subHeaderRowIndex}`;
  ws.headerFooter = {
    oddFooter: `&L&8${data.companyName} — Gizli ve Ticari&R&8Sayfa &P / &N`,
  };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = data.tenderTitle.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s]/g, '').trim();
  a.download = `${safeName}_karsilastirma.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
