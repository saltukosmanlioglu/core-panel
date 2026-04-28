import ExcelJS from 'exceljs';

interface TenderItem {
  rowNo: number;
  posNo: string | null;
  description: string;
  unit: string;
  quantity: number;
  location: string | null;
}

interface TenderFormExportData {
  tenderTitle: string;
  projectName: string;
  categoryName: string;
  deadline: string | null;
  companyName: string;
  companyLogoPath?: string | null;
  items: TenderItem[];
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
  amberLight:  'FFFBEB',
  amberBorder: 'F59E0B',
  amberDark:   'B45309',
  orangeLight: 'FFF7ED',
  orangeText:  'C2410C',
  orangeBorder:'EA580C',
  headerText:  'FFFFFF',
  subText:     '64748B',
};

// Change 1: short unit labels
const UNIT_LABELS: Record<string, string> = {
  m2: 'm²',
  m3: 'm³',
  mt: 'mt',
  adet: 'adet',
  kg: 'kg',
  ton: 'ton',
  m: 'm',
  lt: 'lt',
};

export const exportTenderForm = async (data: TenderFormExportData): Promise<void> => {
  const wb = new ExcelJS.Workbook();
  wb.creator = data.companyName;
  wb.created = new Date();

  const ws = wb.addWorksheet('Teklif Formu', {
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    },
  });

  // Change 2: 11 columns — G(Not) and J(Para Birimi) inserted; H←G, I←H, K←I
  ws.columns = [
    { key: 'rowNo',       width: 5  },  // A
    { key: 'posNo',       width: 10 },  // B
    { key: 'description', width: 40 },  // C
    { key: 'unit',        width: 14 },  // D
    { key: 'quantity',    width: 12 },  // E
    { key: 'location',    width: 18 },  // F
    { key: 'note',        width: 18 },  // G (new)
    { key: 'material',    width: 16 },  // H (was G)
    { key: 'labor',       width: 16 },  // I (was H)
    { key: 'currency',    width: 10 },  // J (new)
    { key: 'total',       width: 18 },  // K (was I)
  ];

  let currentRow = 1;

  // ─── Accent row ───────────────────────────────────────────────────────────
  ws.mergeCells(`A${currentRow}:K${currentRow}`);
  ws.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navyDark } };
  ws.getRow(currentRow).height = 6;
  currentRow++;

  // ─── Company name ─────────────────────────────────────────────────────────
  ws.mergeCells(`A${currentRow}:K${currentRow}`);
  const companyCell = ws.getCell(`A${currentRow}`);
  companyCell.value = data.companyName.toUpperCase();
  companyCell.font = { name: 'Calibri', bold: true, size: 18, color: { argb: COLORS.headerText } };
  companyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navyDark } };
  companyCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(currentRow).height = 38;
  currentRow++;

  // ─── Tagline ──────────────────────────────────────────────────────────────
  ws.mergeCells(`A${currentRow}:K${currentRow}`);
  const taglineCell = ws.getCell(`A${currentRow}`);
  taglineCell.value = 'Güven  •  Kalite  •  Sürdürülebilirlik';
  taglineCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'B8D4EC' } };
  taglineCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navyDark } };
  taglineCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(currentRow).height = 16;
  currentRow++;

  // ─── Document title + date ────────────────────────────────────────────────
  const today = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  ws.mergeCells(`A${currentRow}:I${currentRow}`);
  const titleCell = ws.getCell(`A${currentRow}`);
  titleCell.value = 'İHALE TEKLİF FORMU';
  titleCell.font = { name: 'Calibri', bold: true, size: 13, color: { argb: COLORS.navy } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navyPale } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  ws.mergeCells(`J${currentRow}:K${currentRow}`);
  const dateCell = ws.getCell(`J${currentRow}`);
  dateCell.value = today;
  dateCell.font = { name: 'Calibri', size: 9, color: { argb: COLORS.gray600 } };
  dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navyPale } };
  dateCell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
  ws.getRow(currentRow).height = 22;
  currentRow++;

  // ─── Thin divider ─────────────────────────────────────────────────────────
  ws.mergeCells(`A${currentRow}:K${currentRow}`);
  ws.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navyLight } };
  ws.getRow(currentRow).height = 3;
  currentRow++;

  // ─── Info block (2-column layout) ─────────────────────────────────────────
  const deadlineStr = data.deadline
    ? new Date(data.deadline).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';

  const infoLayout: Array<[string, string, string, string]> = [
    ['İhale Adı', data.tenderTitle,   'Kategori',          data.categoryName],
    ['Proje',     data.projectName,   'Son Teklif Tarihi', deadlineStr],
  ];

  for (const [leftLabel, leftValue, rightLabel, rightValue] of infoLayout) {
    ws.mergeCells(`A${currentRow}:B${currentRow}`);
    const leftLabelCell = ws.getCell(`A${currentRow}`);
    leftLabelCell.value = leftLabel;
    leftLabelCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.gray600 } };
    leftLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.gray100 } };
    leftLabelCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    leftLabelCell.border = { bottom: { style: 'thin', color: { argb: COLORS.gray200 } } };

    ws.mergeCells(`C${currentRow}:E${currentRow}`);
    const leftValueCell = ws.getCell(`C${currentRow}`);
    leftValueCell.value = leftValue;
    leftValueCell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.gray900 } };
    leftValueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.white } };
    leftValueCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    leftValueCell.border = { bottom: { style: 'thin', color: { argb: COLORS.gray200 } } };

    ws.mergeCells(`F${currentRow}:G${currentRow}`);
    const rightLabelCell = ws.getCell(`F${currentRow}`);
    rightLabelCell.value = rightLabel;
    rightLabelCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.gray600 } };
    rightLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.gray100 } };
    rightLabelCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    rightLabelCell.border = { bottom: { style: 'thin', color: { argb: COLORS.gray200 } } };

    // Change 2: extended from H:I to H:K to fill new columns
    ws.mergeCells(`H${currentRow}:K${currentRow}`);
    const rightValueCell = ws.getCell(`H${currentRow}`);
    rightValueCell.value = rightValue;
    rightValueCell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.gray900 } };
    rightValueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.white } };
    rightValueCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    rightValueCell.border = { bottom: { style: 'thin', color: { argb: COLORS.gray200 } } };

    ws.getRow(currentRow).height = 22;
    currentRow++;
  }

  // Change 4: Firma Adı row (editable)
  ws.mergeCells(`A${currentRow}:B${currentRow}`);
  const firmaLabelCell = ws.getCell(`A${currentRow}`);
  firmaLabelCell.value = 'Firma Adı';
  firmaLabelCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.gray600 } };
  firmaLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.gray100 } };
  firmaLabelCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  firmaLabelCell.border = { bottom: { style: 'thin', color: { argb: COLORS.gray200 } } };

  ws.mergeCells(`C${currentRow}:K${currentRow}`);
  const firmaAdiValueAddr = `C${currentRow}`;
  const firmaValueCell = ws.getCell(firmaAdiValueAddr);
  firmaValueCell.value = null;
  firmaValueCell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.gray900 } };
  firmaValueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.amberLight } };
  firmaValueCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  firmaValueCell.border = {
    bottom: { style: 'thin', color: { argb: COLORS.gray200 } },
    left: { style: 'medium', color: { argb: COLORS.amberBorder } },
  };
  ws.getRow(currentRow).height = 22;
  currentRow++;

  // ─── Blank separator ──────────────────────────────────────────────────────
  ws.getRow(currentRow).height = 8;
  currentRow++;

  // Change 3: Exchange rate block ────────────────────────────────────────────
  ws.mergeCells(`A${currentRow}:K${currentRow}`);
  const kurHeaderCell = ws.getCell(`A${currentRow}`);
  kurHeaderCell.value = 'Kur Bilgisi';
  kurHeaderCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.gray600 } };
  kurHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.gray100 } };
  kurHeaderCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(currentRow).height = 16;
  currentRow++;

  const rateRowIndex = currentRow;
  const usdRateCell = `C${rateRowIndex}`;
  const eurRateCell = `F${rateRowIndex}`;
  const usdRateRef = `$C$${rateRowIndex}`;
  const eurRateRef = `$F$${rateRowIndex}`;

  ws.mergeCells(`A${currentRow}:B${currentRow}`);
  const usdLabelCell = ws.getCell(`A${currentRow}`);
  usdLabelCell.value = 'USD ($)';
  usdLabelCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.gray600 } };
  usdLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.gray100 } };
  usdLabelCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  const usdValueCell = ws.getCell(usdRateCell);
  usdValueCell.value = 32.50;
  usdValueCell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.gray900 } };
  usdValueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.amberLight } };
  usdValueCell.numFmt = '#,##0.00';
  usdValueCell.alignment = { vertical: 'middle', horizontal: 'right' };
  usdValueCell.border = { left: { style: 'medium', color: { argb: COLORS.amberBorder } } };

  ws.mergeCells(`D${currentRow}:E${currentRow}`);
  const eurLabelCell = ws.getCell(`D${currentRow}`);
  eurLabelCell.value = 'EUR (€)';
  eurLabelCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.gray600 } };
  eurLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.gray100 } };
  eurLabelCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  const eurValueCell = ws.getCell(eurRateCell);
  eurValueCell.value = 35.20;
  eurValueCell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.gray900 } };
  eurValueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.amberLight } };
  eurValueCell.numFmt = '#,##0.00';
  eurValueCell.alignment = { vertical: 'middle', horizontal: 'right' };
  eurValueCell.border = { left: { style: 'medium', color: { argb: COLORS.amberBorder } } };

  ws.mergeCells(`G${currentRow}:K${currentRow}`);
  ws.getCell(`G${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.white } };

  ws.getRow(currentRow).height = 22;
  currentRow++;

  // ─── Blank separator ──────────────────────────────────────────────────────
  ws.getRow(currentRow).height = 8;
  currentRow++;

  // ─── Editable notice ──────────────────────────────────────────────────────
  ws.mergeCells(`A${currentRow}:K${currentRow}`);
  const noticeCell = ws.getCell(`A${currentRow}`);
  noticeCell.value = '⚠  Sarı ile işaretli hücreler (Not, Malzeme, İşçilik Birim Fiyat, Para Birimi, kur bilgisi ve firma adı) doldurulacaktır. Diğer hücreler değiştirilemez.';
  noticeCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: '78350F' } };
  noticeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
  noticeCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  noticeCell.border = { left: { style: 'medium', color: { argb: COLORS.amberBorder } } };
  ws.getRow(currentRow).height = 18;
  currentRow++;

  // ─── Blank separator ──────────────────────────────────────────────────────
  ws.getRow(currentRow).height = 6;
  currentRow++;

  // ─── Table header ─────────────────────────────────────────────────────────
  const tableHeaderRowIndex = currentRow;
  // Change 2: updated headers; G(Not), H(Malzeme), I(İşçilik), J(Para Birimi), K(Tutar TL)
  const headers = ['#', 'Pos No', 'Tanım', 'Birim', 'Miktar', 'Konum', 'Not', 'Malzeme\nBirim Fiyat', 'İşçilik\nBirim Fiyat', 'Para Birimi', 'Tutar (TL)'];
  const headerRow = ws.getRow(currentRow);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    // Editable columns (amber): G(6), H(7), I(8), J(9) — K(10) stays locked
    const isEditable = i >= 6 && i <= 9;
    cell.value = h;
    cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: COLORS.headerText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEditable ? COLORS.amberDark : COLORS.navy } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: COLORS.gray200 } },
      bottom: { style: 'medium', color: { argb: COLORS.navy } },
      left: { style: 'thin', color: { argb: COLORS.gray200 } },
      right: { style: 'thin', color: { argb: COLORS.gray200 } },
    };
  });
  headerRow.height = 36;
  currentRow++;

  // ─── Data rows ────────────────────────────────────────────────────────────
  const dataStartRow = currentRow;

  for (let idx = 0; idx < data.items.length; idx++) {
    const item = data.items[idx];
    const r = currentRow;
    const isOdd = idx % 2 === 0;
    const rowBg = isOdd ? COLORS.white : COLORS.offWhite;
    const dRow = ws.getRow(r);

    // A-F: locked data cells
    const values: (number | string)[] = [
      item.rowNo,
      item.posNo ?? '',
      item.description,
      UNIT_LABELS[item.unit] ?? item.unit,
      item.quantity,
      item.location ?? '',
    ];

    values.forEach((val, i) => {
      const cell = dRow.getCell(i + 1);
      cell.value = val;
      cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.gray900 } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: i === 2 ? 'left' : 'center',
        wrapText: true,
        indent: i === 2 ? 1 : 0,
      };
      if (i === 4) {
        cell.numFmt = '#,##0.000';
      }
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.gray200 } },
        bottom: { style: 'thin', color: { argb: COLORS.gray200 } },
        left: { style: 'thin', color: { argb: COLORS.gray200 } },
        right: { style: 'thin', color: { argb: COLORS.gray200 } },
      };
    });

    // Change 5: Column G (7) — Not (editable, amber, wrapText)
    const noteCell = dRow.getCell(7);
    noteCell.value = null;
    noteCell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.gray900 } };
    noteCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.amberLight } };
    noteCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    noteCell.border = {
      top: { style: 'thin', color: { argb: COLORS.gray200 } },
      bottom: { style: 'thin', color: { argb: COLORS.gray200 } },
      left: { style: 'medium', color: { argb: COLORS.amberBorder } },
      right: { style: 'thin', color: { argb: COLORS.gray200 } },
    };

    // Column H (8): Malzeme Birim Fiyat (editable, amber)
    const materialCell = dRow.getCell(8);
    materialCell.value = null;
    materialCell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.gray900 } };
    materialCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.amberLight } };
    materialCell.numFmt = '#,##0.00';
    materialCell.alignment = { vertical: 'middle', horizontal: 'right' };
    materialCell.border = {
      top: { style: 'thin', color: { argb: COLORS.gray200 } },
      bottom: { style: 'thin', color: { argb: COLORS.gray200 } },
      left: { style: 'medium', color: { argb: COLORS.amberBorder } },
      right: { style: 'thin', color: { argb: COLORS.gray200 } },
    };

    // Column I (9): İşçilik Birim Fiyat (editable, amber)
    const laborCell = dRow.getCell(9);
    laborCell.value = null;
    laborCell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.gray900 } };
    laborCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.amberLight } };
    laborCell.numFmt = '#,##0.00';
    laborCell.alignment = { vertical: 'middle', horizontal: 'right' };
    laborCell.border = {
      top: { style: 'thin', color: { argb: COLORS.gray200 } },
      bottom: { style: 'thin', color: { argb: COLORS.gray200 } },
      left: { style: 'medium', color: { argb: COLORS.amberBorder } },
      right: { style: 'thin', color: { argb: COLORS.gray200 } },
    };

    // Change 6: Column J (10) — Para Birimi (editable, amber, dropdown)
    const currencyCell = dRow.getCell(10);
    currencyCell.value = 'TRY';
    currencyCell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.gray900 } };
    currencyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.amberLight } };
    currencyCell.alignment = { vertical: 'middle', horizontal: 'center' };
    currencyCell.border = {
      top: { style: 'thin', color: { argb: COLORS.gray200 } },
      bottom: { style: 'thin', color: { argb: COLORS.gray200 } },
      left: { style: 'medium', color: { argb: COLORS.amberBorder } },
      right: { style: 'thin', color: { argb: COLORS.gray200 } },
    };
    currencyCell.dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"TRY,USD,EUR"'],
    };

    // Change 7: Column K (11) — Tutar TL, currency-aware formula
    const totalCell = dRow.getCell(11);
    totalCell.value = {
      formula: `IF(J${r}="USD",E${r}*(H${r}+I${r})*${usdRateRef},IF(J${r}="EUR",E${r}*(H${r}+I${r})*${eurRateRef},E${r}*(H${r}+I${r})))`,
      result: 0,
    };
    totalCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.gray900 } };
    totalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.offWhite } };
    totalCell.numFmt = '#,##0.00 ₺';
    totalCell.alignment = { vertical: 'middle', horizontal: 'right' };
    totalCell.border = {
      top: { style: 'thin', color: { argb: COLORS.gray200 } },
      bottom: { style: 'thin', color: { argb: COLORS.gray200 } },
      left: { style: 'thin', color: { argb: COLORS.gray200 } },
      right: { style: 'medium', color: { argb: COLORS.gray200 } },
    };

    const lines = Math.ceil(item.description.length / 45);
    dRow.height = Math.max(20, lines * 15);

    currentRow++;
  }

  const dataEndRow = currentRow - 1;

  // ─── Blank separator ──────────────────────────────────────────────────────
  ws.getRow(currentRow).height = 6;
  currentRow++;

  // ─── Total row ────────────────────────────────────────────────────────────
  // Change 2: label A:J, grand total K
  ws.mergeCells(`A${currentRow}:J${currentRow}`);
  const totalLabelCell = ws.getCell(`A${currentRow}`);
  totalLabelCell.value = 'TOPLAM TUTAR (KDV HARİÇ)';
  totalLabelCell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: COLORS.orangeText } };
  totalLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.orangeLight } };
  totalLabelCell.alignment = { vertical: 'middle', horizontal: 'right', indent: 2 };
  totalLabelCell.border = {
    top: { style: 'medium', color: { argb: COLORS.orangeBorder } },
    bottom: { style: 'medium', color: { argb: COLORS.orangeBorder } },
    left: { style: 'medium', color: { argb: COLORS.orangeBorder } },
  };

  // Change 8: SUM over column K
  const grandTotalCell = ws.getCell(`K${currentRow}`);
  grandTotalCell.value = {
    formula: `SUM(K${dataStartRow}:K${dataEndRow})`,
    result: 0,
  };
  grandTotalCell.font = { name: 'Calibri', bold: true, size: 12, color: { argb: COLORS.orangeText } };
  grandTotalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.orangeLight } };
  grandTotalCell.numFmt = '#,##0.00 ₺';
  grandTotalCell.alignment = { vertical: 'middle', horizontal: 'right' };
  grandTotalCell.border = {
    top: { style: 'medium', color: { argb: COLORS.orangeBorder } },
    bottom: { style: 'medium', color: { argb: COLORS.orangeBorder } },
    left: { style: 'thin', color: { argb: COLORS.orangeBorder } },
    right: { style: 'medium', color: { argb: COLORS.orangeBorder } },
  };
  ws.getRow(currentRow).height = 28;
  // Change 9: notes/footer row removed — no further rows written

  // ─── Footer ───────────────────────────────────────────────────────────────
  ws.headerFooter = {
    oddFooter: `&L&8${data.companyName} — Gizli ve Ticari&R&8Sayfa &P / &N`,
  };

  // ─── Freeze panes ─────────────────────────────────────────────────────────
  ws.views = [{
    state: 'frozen',
    xSplit: 0,
    ySplit: tableHeaderRowIndex,
    topLeftCell: `A${tableHeaderRowIndex + 1}`,
    activeCell: 'A1',
  }];

  // ─── Print titles ─────────────────────────────────────────────────────────
  ws.pageSetup.printTitlesRow = `${tableHeaderRowIndex}:${tableHeaderRowIndex}`;

  // Change 11: Sheet protection — unlock G,H,I,J in data rows; K stays locked
  await ws.protect('', {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    insertRows: false,
    deleteColumns: false,
    deleteRows: false,
    sort: false,
    autoFilter: false,
  });

  for (let r = dataStartRow; r <= dataEndRow; r++) {
    ws.getCell(`G${r}`).protection = { locked: false }; // Not
    ws.getCell(`H${r}`).protection = { locked: false }; // Malzeme
    ws.getCell(`I${r}`).protection = { locked: false }; // İşçilik
    ws.getCell(`J${r}`).protection = { locked: false }; // Para Birimi
  }
  ws.getCell(firmaAdiValueAddr).protection = { locked: false };
  ws.getCell(usdRateCell).protection = { locked: false };
  ws.getCell(eurRateCell).protection = { locked: false };

  // ─── Download ─────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = data.tenderTitle.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s]/g, '').trim();
  a.download = `${safeName}_teklif_formu.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
