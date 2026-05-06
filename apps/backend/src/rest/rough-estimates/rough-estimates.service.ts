import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import puppeteer from 'puppeteer';
import type { RoughEstimate, RoughEstimateUnit } from '@core-panel/shared';

export const DEFAULT_OFFER_LETTER_TITLE =
  'YARISI BİZDEN KAMPANYASI İLE ANAHTAR TESLİMİ GÖTÜRÜ BEDELLE İNŞAAT YAPIMI';

export const DEFAULT_OFFER_LETTER_CONTENT = `
<p><strong>1. İnşaat yapımının çok kısa zamanda gerçekleşmesi ve kat maliklerinin kısa sürede yeni binaya taşınabilmeleri için aşağıda belirtilen 2 maddede karşılıklı olarak mutabık olunmalıdır;</strong></p>
<ul>
  <li>Tüm kat maliklerinin yeniden yapıma mutabakat vermesi</li>
  <li>Kat malikleri kendi paylarına düşen bedelleri ödemesi</li>
</ul>
<p><strong>2. Teklife dahil olan işler;</strong></p>
<ul>
  <li>Mevzuat gereği yapılacak olan 1. Bodrum kat bedeli</li>
  <li>Bina yıkım ruhsatı ve yıkım bedeli</li>
  <li>Proje ve inşaat ruhsat bedeli</li>
  <li>Onaylı projesindeki tüm imalatlar bedeli</li>
</ul>
<p><strong>3. Diğer kurallar;</strong></p>
<ol>
  <li>Ruhsat alındığından itibaren inşaat teslim süresi {{delivery_months}} aydır.</li>
  <li>İmar planındaki şartlara göre brüt inşaat alanı {{total_brut_area}} m²'dir. Buna ilave olarak {{basement_area}} m² bodrum kat eklendiğinde {{total_with_basement}} m² toplam inşaat alanı olacaktır.</li>
  <li>Teklifimiz sabit bedelli anahtar teslimi inşaat yapımını kapsamakta olup tapu ve imar durumundaki verilere göre hazırlanmıştır. Bağımsız bölüm malikleri ekteki tabloya göre ödeme yapacaktır.</li>
  <li>Tablodaki daire brüt alanları yaklaşık olarak hesaplanmıştır. Kesin daire alanları bina yönetimi ile koordineli olarak kesin proje safhasında netleştirilecektir.</li>
  <li>İnşaat, en son (2018 yılı) Türkiye Bina Deprem Yönetmeliğine göre inşa edilecektir.</li>
  <li>Zemin etüd raporu alındığında zeminle ilgili zemin ıslahı, fore kazık ya da iksa gibi ilave işlemler gerekmesi halinde çıkan bedel kat maliklerinden tahsil edilecektir.</li>
  <li>Mevcut binanın bodrum kat dahil toplam alanı yeni yapılacak inşaatın otopark dahil brüt inşaat alanı ve mevcut binanın bağımsız bölüm sayısı yeni durumda 1,5 katını geçmesi halinde yarısı bizden bakanlık desteklerinden faydalanamamaktadır.</li>
  <li>Yeni yapılacak yapıya ilişkin paylaşım ve ödeme şartlarında kat malikleri ile mutabık kalınması halinde, diğer ayrıntılar sözleşme sayfasında ikmal edilecektir.</li>
  <li>Teklifimiz {{offer_valid_until}} tarihine kadar geçerlidir.</li>
</ol>
`.trim();

interface AreaInput {
  netParcelArea?: number | null;
  taksMin?: number | null;
  taksMax?: number | null;
  kaks?: number | null;
  regulationBonusPercent?: number | null;
}

interface CalculatedAreas {
  minBaseArea: number | null;
  maxBaseArea: number | null;
  maxConstructionArea: number | null;
  regulationBonusArea: number | null;
  totalBrutArea: number | null;
}

const m2Formatter = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

const moneyFormatter = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function asNumber(value: number | null | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatM2(value: number | null | undefined): string {
  return m2Formatter.format(asNumber(value));
}

function formatMoney(value: number | null | undefined): string {
  return `${moneyFormatter.format(asNumber(value))} ₺`;
}

function formatMoneyPlain(value: number | null | undefined): string {
  return moneyFormatter.format(asNumber(value));
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function todayFormatted(): string {
  return new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function totalWithBasements(estimate: RoughEstimate): number {
  return asNumber(estimate.totalBrutArea) +
    asNumber(estimate.basementArea) +
    asNumber(estimate.secondBasementArea) +
    asNumber(estimate.thirdBasementArea);
}

export function calculateAreas(input: AreaInput): CalculatedAreas {
  const netParcelArea = input.netParcelArea;
  const taksMin = input.taksMin;
  const taksMax = input.taksMax;
  const kaks = input.kaks;
  const bonusPercent = input.regulationBonusPercent ?? 30;

  const maxConstructionArea = netParcelArea != null && kaks != null ? round2(kaks * netParcelArea) : null;
  const regulationBonusArea = maxConstructionArea != null ? round2(maxConstructionArea * (bonusPercent / 100)) : null;

  return {
    minBaseArea: netParcelArea != null && taksMin != null ? round2(taksMin * netParcelArea) : null,
    maxBaseArea: netParcelArea != null && taksMax != null ? round2(taksMax * netParcelArea) : null,
    maxConstructionArea,
    regulationBonusArea,
    totalBrutArea: maxConstructionArea != null && regulationBonusArea != null
      ? round2(maxConstructionArea + regulationBonusArea)
      : null,
  };
}

export function calculateCostPerSqm(totalCost: number | null | undefined, totalBrutArea: number | null | undefined): number | null {
  if (!totalCost || !totalBrutArea) return null;
  return round2(totalCost / totalBrutArea);
}

export function replaceTemplateVariables(html: string, estimate: RoughEstimate): string {
  const variables: Record<string, string> = {
    delivery_months: String(estimate.deliveryMonths ?? 10),
    total_brut_area: formatM2(estimate.totalBrutArea),
    basement_area: formatM2(estimate.basementArea),
    total_with_basement: formatM2(totalWithBasements(estimate)),
    offer_valid_until: formatDate(estimate.offerValidUntil),
    net_area: formatM2(estimate.netParcelArea),
    ilce: '',
  };

  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => variables[key] ?? '');
}

function sortedUnits(units: RoughEstimateUnit[]): RoughEstimateUnit[] {
  return [...units].sort((a, b) => a.floorNumber - b.floorNumber || a.unitNumber - b.unitNumber);
}

function sortedBuildingUnits(units: RoughEstimateUnit[]): RoughEstimateUnit[] {
  return [...units].sort((a, b) => b.floorNumber - a.floorNumber || a.unitNumber - b.unitNumber);
}

function unitTypeLabel(type: string): string {
  if (type === 'shop') return 'Dükkan';
  if (type === 'common') return 'Ortak Alan';
  if (type === 'roof') return 'Çatı';
  return 'Konut';
}

function ownerTypeLabel(type: string): string {
  if (type === 'contractor') return 'Mila İnşaat';
  if (type === 'common') return 'Ortak Alan';
  return 'Tapu Sahibi';
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function craneLogoSvg(size = 44): string {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M9 52h42" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
      <path d="M20 52V16h8v36" fill="none" stroke="currentColor" stroke-width="4"/>
      <path d="M14 16h42" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
      <path d="M28 16l16 14M28 30l16-14" stroke="currentColor" stroke-width="3"/>
      <path d="M52 16v15" stroke="currentColor" stroke-width="3"/>
      <rect x="48" y="31" width="8" height="7" rx="1" fill="currentColor"/>
      <path d="M20 22l8 8M28 22l-8 8" stroke="currentColor" stroke-width="3"/>
    </svg>
  `;
}

function companyFooter(): string {
  return `
    <div class="footer-bar">
      <div class="footer-brand">
        ${craneLogoSvg(22)}
        <strong>MİLA İNŞAAT</strong>
      </div>
      <div>www.milainsaat.com&nbsp;&nbsp;|&nbsp;&nbsp;info@milainsaat.com&nbsp;&nbsp;|&nbsp;&nbsp;+90 216 390 73 00</div>
    </div>
  `;
}

function unitOwnerHeading(unit: RoughEstimateUnit): string {
  if (unit.ownerType === 'contractor') return 'MİLA İNŞAAT';
  if (unit.ownerType === 'common') return 'ORTAK ALAN';
  return 'TAPU SAHİBİ';
}

function unitPaymentLine(unit: RoughEstimateUnit): string {
  if (unit.ownerType === 'contractor') return '<div class="unit-line">Ödeme yok.</div>';
  if (unit.hasPayment && unit.paymentAmount != null) {
    return `<div class="unit-line">Ödeme: ${escapeHtml(formatMoney(unit.paymentAmount))}</div>`;
  }
  return '';
}

function renderUnitCell(unit: RoughEstimateUnit): string {
  const ownerClass = unit.ownerType === 'contractor' ? 'contractor' : unit.ownerType === 'common' ? 'common' : 'property-owner';
  const grossLine = unit.grossArea != null ? `<div class="unit-line">Brüt: ${escapeHtml(formatM2(unit.grossArea))} m²</div>` : '';

  return `
    <div class="unit-cell ${ownerClass}">
      <div class="unit-heading">${unitOwnerHeading(unit)}</div>
      ${grossLine}
      ${unitPaymentLine(unit)}
      <div class="unit-no">${escapeHtml(unit.unitNumber)}</div>
    </div>
  `;
}

function renderBuildingDiagram(estimate: RoughEstimate, units: RoughEstimateUnit[]): string {
  const roofUnits = sortedBuildingUnits(units).filter((unit) => unit.unitType === 'roof');
  const floorUnits = sortedBuildingUnits(units).filter((unit) => unit.unitType !== 'roof' && unit.floorNumber >= 0);
  const floorNumbers = Array.from(new Set(floorUnits.map((unit) => unit.floorNumber))).sort((a, b) => b - a);

  const roofRow = estimate.hasRoofUnit && roofUnits.length > 0
    ? `<div class="roof-row">${roofUnits.map(renderUnitCell).join('')}</div>`
    : '';

  const floorRows = floorNumbers.map((floorNumber) => {
    const currentUnits = floorUnits
      .filter((unit) => unit.floorNumber === floorNumber)
      .sort((a, b) => a.unitNumber - b.unitNumber);
    const label = currentUnits[0]?.floorLabel ?? `${floorNumber}. Kat`;

    return `
      <div class="floor-row">
        <div class="floor-label"><span>${escapeHtml(label)}</span></div>
        <div class="floor-cells">${currentUnits.map(renderUnitCell).join('')}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="building">
      <svg width="100%" height="60" viewBox="0 0 800 60" preserveAspectRatio="none">
        <polygon points="0,60 400,0 800,60" fill="#2d5a4a"></polygon>
      </svg>
      ${roofRow}
      ${floorRows}
      <div class="basement-row">
        <strong>${escapeHtml(formatM2(estimate.basementArea))} m²&nbsp;&nbsp; ORTAK ALAN</strong>
      </div>
    </div>
  `;
}

function buildTemplateHTML(
  estimate: RoughEstimate,
  units: RoughEstimateUnit[],
  templates: { page1: string; page2: string; page3: string; page4: string; page5: string },
): string {
  function fmtDate(d?: Date | string | null): string {
    if (!d) return new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function fmtNumber(n?: number | null): string {
    if (!n) return '0,000';
    return Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }

  function fmtCurrency(n?: number | null): string {
    if (!n) return '—';
    return Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  }

  function processContent(content?: string | null): string {
    if (!content) return '';
    return content
      .replace(/\{\{delivery_months\}\}/g, String(estimate.deliveryMonths ?? 10))
      .replace(/\{\{total_brut_area\}\}/g, fmtNumber(estimate.totalBrutArea))
      .replace(/\{\{basement_area\}\}/g, fmtNumber(estimate.basementArea))
      .replace(/\{\{total_with_basement\}\}/g, fmtNumber((estimate.totalBrutArea ?? 0) + (estimate.basementArea ?? 0)))
      .replace(/\{\{offer_valid_until\}\}/g, fmtDate(estimate.offerValidUntil))
      .replace(/\{\{net_area\}\}/g, fmtNumber(estimate.netParcelArea));
  }

  function buildingDiagramHTML(diagramUnits: RoughEstimateUnit[], est: RoughEstimate): string {
    const sorted = [...diagramUnits].sort(
      (a, b) => b.floorNumber - a.floorNumber || a.unitNumber - b.unitNumber,
    );
    const floorUnitsOnly = sorted.filter((unit) => unit.floorNumber >= 0);

    const floorMap = new Map<number, RoughEstimateUnit[]>();
    for (const unit of floorUnitsOnly) {
      if (!floorMap.has(unit.floorNumber)) floorMap.set(unit.floorNumber, []);
      floorMap.get(unit.floorNumber)!.push(unit);
    }

    const floors = Array.from(floorMap.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([, floorUnits]) => floorUnits);

    const availableHeightMm = 230;
    const totalRows = floors.length + 2;
    const rowHeightMm = Math.min(22, availableHeightMm / totalRows);
    const floorHeightPx = Math.round(rowHeightMm * 3.78);
    const fontSize = floorHeightPx > 65 ? 7.5 : floorHeightPx > 50 ? 7 : 6;
    const smallFontSize = fontSize - 0.5;

    let html = '<div style="display:flex;flex-direction:column;width:100%;height:100%;gap:0;">';

    html += `<div style="width:100%;height:${floorHeightPx}px;flex-shrink:0;position:relative;">
      <svg width="100%" height="${floorHeightPx}" viewBox="0 0 600 ${floorHeightPx}" preserveAspectRatio="none" style="display:block;">
        <polygon points="0,${floorHeightPx} 300,0 600,${floorHeightPx}" fill="#2d5a4a"/>
      </svg>
    </div>`;

    for (const floorUnits of floors) {
      const floorLabel = floorUnits[0].floorLabel || `${floorUnits[0].floorNumber}. Kat`;

      html += `<div style="display:flex;width:100%;height:${floorHeightPx}px;flex-shrink:0;border:1.5px solid #2d5a4a;border-bottom:none;">`;
      html += '<div style="display:flex;flex:1;">';

      for (const unit of floorUnits) {
        const bg = unit.ownerType === 'contractor' ? '#c8e6f5' : unit.ownerType === 'common' ? '#eeeeee' : '#ffffff';
        const label =
          unit.ownerType === 'contractor' ? 'MİLA İNŞAAT' : unit.ownerType === 'common' ? 'ORTAK ALAN' : 'TAPU SAHİBİ';
        const textColor = unit.ownerType === 'contractor' ? '#1a4a3a' : '#333';

        html += `<div style="flex:1;background:${bg};border-right:1px solid #ccc;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2px 4px;position:relative;overflow:hidden;text-align:center;">
          <div style="font-weight:700;font-size:${fontSize}pt;color:${textColor};">${label}</div>
          ${unit.grossArea ? `<div style="font-size:${smallFontSize}pt;color:#555;">Brüt: ${Number(unit.grossArea).toFixed(2)} m²</div>` : ''}
          ${unit.hasPayment && unit.paymentAmount ? `<div style="font-size:${smallFontSize}pt;color:#444;">Ödeme: ${fmtCurrency(unit.paymentAmount)}</div>` : unit.ownerType === 'contractor' ? `<div style="font-size:${smallFontSize}pt;color:#888;">Ödeme yok.</div>` : ''}
          <div style="position:absolute;bottom:2px;right:3px;font-size:${smallFontSize}pt;color:#bbb;">${String(unit.unitNumber || '')}</div>
        </div>`;
      }

      html += '</div>';
      html += `<div style="width:28px;flex-shrink:0;background:#f5f5f5;border-left:1px solid #ccc;display:flex;align-items:center;justify-content:center;writing-mode:vertical-rl;transform:rotate(180deg);font-size:${smallFontSize}pt;font-weight:bold;color:#1a4a3a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${floorLabel}</div>`;
      html += '</div>';
    }

    html += `<div style="display:flex;width:100%;height:${floorHeightPx}px;flex-shrink:0;border:1.5px solid #2d5a4a;background:#e8e8e8;align-items:center;justify-content:center;position:relative;">
      <div style="text-align:center;">
        <div style="font-weight:bold;font-size:${fontSize}pt;color:#333;">${fmtNumber(est.basementArea)} m²</div>
        <div style="font-size:${smallFontSize}pt;color:#555;">ORTAK ALAN</div>
      </div>
      <div style="position:absolute;right:4px;writing-mode:vertical-rl;transform:rotate(180deg);font-size:${smallFontSize}pt;font-weight:bold;color:#1a4a3a;">BODRUM KAT</div>
    </div>`;

    html += '</div>';
    return html;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; }
  .page {
    width: 210mm;
    height: 297mm;
    position: relative;
    overflow: hidden;
    page-break-after: always;
  }
  .page:last-child { page-break-after: avoid; }
  .bg {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    object-fit: fill;
  }
  .overlay {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
  }
</style>
</head>
<body>

<!-- PAGE 1: COVER -->
<div class="page">
  <img class="bg" src="data:image/png;base64,${templates.page1}">
  <div class="overlay">
    <div style="position:absolute;top:24%;left:0;right:0;text-align:center;font-size:15pt;font-weight:bold;color:#1a4a3a;padding:0 50px;line-height:1.3;">${estimate.projectTitle || ''}</div>
    <div style="position:absolute;top:30%;right:50px;font-size:10pt;color:#555;">${fmtDate(new Date())}</div>
  </div>
</div>

<!-- PAGE 2: OFFER LETTER -->
<div class="page">
  <img class="bg" src="data:image/png;base64,${templates.page2}">
  <div class="overlay">
    <div style="position:absolute;top:8%;left:0;right:0;text-align:center;font-size:9pt;color:#444;">(${estimate.projectTitle || ''})</div>
    <div style="position:absolute;top:19%;left:8%;right:8%;bottom:23%;font-size:8.5pt;color:#222;line-height:1.7;overflow:hidden;">${processContent(estimate.offerLetterContent ?? DEFAULT_OFFER_LETTER_CONTENT)}</div>
    <div style="position:absolute;bottom:17%;left:8%;font-size:8.5pt;color:#333;line-height:1.6;">TCMB Efektif Döviz Satış Kuru<br>1 Dolar (USD): ${estimate.usdRate ? Number(estimate.usdRate).toFixed(2) : '—'} TL</div>
  </div>
</div>

<!-- PAGE 3: FLOOR PLAN DIAGRAM -->
<div class="page">
  <img class="bg" src="data:image/png;base64,${templates.page3}">
  <div class="overlay">
    <div style="position:absolute;top:2.8%;left:0;right:0;text-align:center;color:white;line-height:1.4;">
      <div style="font-size:9.5pt;font-weight:bold;letter-spacing:0.5px;">${(estimate.projectTitle || '').toUpperCase()}</div>
      <div style="font-size:7.5pt;">KAT MALİKLERİ PAYLAŞIM KROKİSİ</div>
    </div>
    <div style="position:absolute;top:9%;left:3.5%;right:3.5%;bottom:10%;">
      ${buildingDiagramHTML(units, estimate)}
    </div>
  </div>
</div>

<!-- PAGE 4: CORPORATE (static) -->
<div class="page">
  <img class="bg" src="data:image/png;base64,${templates.page4}">
</div>

<!-- PAGE 5: PROJECTS (static) -->
<div class="page">
  <img class="bg" src="data:image/png;base64,${templates.page5}">
</div>

</body>
</html>`;
}

export async function generatePDF(estimate: RoughEstimate, units: RoughEstimateUnit[]): Promise<Buffer> {
  const templateDir = path.join(__dirname, '../../assets/pdf-templates');
  const toBase64 = (filename: string) =>
    fs.readFileSync(path.join(templateDir, filename)).toString('base64');

  const templates = {
    page1: toBase64('page-1.png'),
    page2: toBase64('page-2.png'),
    page3: toBase64('page-3.png'),
    page4: toBase64('page-4.png'),
    page5: toBase64('page-5.png'),
  };

  const html = buildTemplateHTML(estimate, units, templates);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await page.evaluate(`
      Promise.all(
        Array.from(document.images)
          .filter((img) => !img.complete)
          .map((img) => new Promise((resolve) => {
            img.onload = img.onerror = resolve;
          }))
      )
    `);
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      timeout: 120000,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function generateExcel(estimate: RoughEstimate, units: RoughEstimateUnit[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  const emsal = workbook.addWorksheet('Emsal Hesabı');
  emsal.columns = [
    { header: 'Açıklama', key: 'label', width: 44 },
    { header: 'Oran', key: 'rate', width: 14 },
    { header: 'Net Alan', key: 'net', width: 18 },
    { header: 'Sonuç', key: 'result', width: 18 },
  ];
  emsal.addRows([
    { label: 'Minimum Taban Alanı', rate: estimate.taksMin, net: estimate.netParcelArea, result: estimate.minBaseArea },
    { label: 'Maksimum Taban Alanı', rate: estimate.taksMax, net: estimate.netParcelArea, result: estimate.maxBaseArea },
    { label: 'Maksimum İnşaat Alanı', rate: estimate.kaks, net: estimate.netParcelArea, result: estimate.maxConstructionArea },
    { label: `Yönetmelikten Kazanılan Alan %${estimate.regulationBonusPercent ?? 30}`, result: estimate.regulationBonusArea },
    { label: 'Toplam Brüt İnşaat Alanı (Bodrum Hariç)', result: estimate.totalBrutArea },
    { label: '1. Bodrum Kat Alanı', result: estimate.basementArea },
    { label: '2. Bodrum Kat Alanı', result: estimate.secondBasementArea },
    { label: '3. Bodrum Kat Alanı', result: estimate.thirdBasementArea },
  ]);
  emsal.getRow(1).font = { bold: true };
  emsal.getRow(6).font = { bold: true };
  emsal.getRow(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9FBE8' } };

  const unitSheet = workbook.addWorksheet('Bağımsız Bölümler');
  unitSheet.columns = [
    { header: 'S.No', key: 'siraNo', width: 8 },
    { header: 'Mülk Sahibi', key: 'ownerName', width: 28 },
    { header: 'Kat', key: 'floorLabel', width: 14 },
    { header: 'No', key: 'unitNumber', width: 8 },
    { header: 'Blok', key: 'block', width: 10 },
    { header: 'Nitelik', key: 'unitType', width: 16 },
    { header: 'Sahip Tipi', key: 'ownerType', width: 18 },
    { header: 'Brüt Alan', key: 'grossArea', width: 14 },
    { header: 'Yangın Merdiveni', key: 'fireEscapeArea', width: 18 },
    { header: 'Ödeme Var mı', key: 'hasPayment', width: 14 },
    { header: 'Ödeme Tutarı', key: 'paymentAmount', width: 18 },
  ];
  sortedUnits(units).forEach((unit, index) => {
    unitSheet.addRow({
      siraNo: index + 1,
      ownerName: unit.ownerName,
      floorLabel: unit.floorLabel,
      unitNumber: unit.unitNumber,
      block: unit.block,
      unitType: unitTypeLabel(unit.unitType),
      ownerType: ownerTypeLabel(unit.ownerType),
      grossArea: unit.grossArea,
      fireEscapeArea: unit.fireEscapeArea,
      hasPayment: unit.hasPayment ? 'Evet' : 'Hayır',
      paymentAmount: unit.paymentAmount,
    });
  });
  const totalGross = units.reduce((sum, unit) => sum + asNumber(unit.grossArea), 0);
  const totalPayment = units.reduce((sum, unit) => unit.hasPayment ? sum + asNumber(unit.paymentAmount) : sum, 0);
  const totalRow = unitSheet.addRow({ ownerName: 'TOPLAM', grossArea: totalGross, paymentAmount: totalPayment });
  totalRow.font = { bold: true };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9FBE8' } };
  unitSheet.views = [{ state: 'frozen', ySplit: 1 }];
  unitSheet.autoFilter = { from: 'A1', to: 'K1' };
  unitSheet.getRow(1).font = { bold: true };

  const summary = workbook.addWorksheet('Özet');
  summary.columns = [{ key: 'metric', width: 30 }, { key: 'value', width: 24 }];
  summary.addRows([
    ['Net Alan', estimate.netParcelArea],
    ['Min Taban', estimate.minBaseArea],
    ['Max Taban', estimate.maxBaseArea],
    ['Max İnşaat', estimate.maxConstructionArea],
    ['Yönetmelik Kazanımı', estimate.regulationBonusArea],
    ['Toplam Brüt', estimate.totalBrutArea],
    ['Bodrum', asNumber(estimate.basementArea) + asNumber(estimate.secondBasementArea) + asNumber(estimate.thirdBasementArea)],
    ['Genel Toplam', totalWithBasements(estimate)],
    ['Tapu Sahibi Sayısı', units.filter((unit) => unit.ownerType === 'property_owner').length],
    ['Toplam Ödeme Tutarı', totalPayment],
  ]);
  summary.eachRow((row) => {
    row.getCell(1).font = { bold: true };
    row.height = 24;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}
