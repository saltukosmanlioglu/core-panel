import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import * as comparisonsRepo from './tender-comparisons.repo';
import * as offerFilesRepo from '../tender-offer-files/tender-offer-files.repo';
import { AppError } from '../../lib/AppError';
import { UPLOADS_DIR } from '../../config/paths';
import { TenantDb } from '../../lib/tenantDb';
import type { ComparisonPriceCell, ComparisonResult, ComparisonSummary } from '../../models/tender-comparison.model';

interface ParsedItem {
  siraNo: number;
  description: string;
  unit: string;
  quantity: number;
  malzemeBirimFiyat: number | null;
  isciliikBirimFiyat: number | null;
  hasMalzemeIscilikAyri: boolean;
  tutar: number;
}

interface ParsedOffer {
  tenantId: string;
  tenantName: string;
  items: ParsedItem[];
  total: number;
}

type XlsxFormat = 'standard' | 'no-header' | 'string-amounts';

function normalizeLabel(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u');
}

function parseAmount(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const cleaned = value
      .replace(/TL/gi, '')
      .replace(/\s/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim();
    const num = Number.parseFloat(cleaned);
    return Number.isNaN(num) ? 0 : num;
  }

  return 0;
}

function parseNullableNumericValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = parseAmount(value);
  return parsed > 0 ? parsed : null;
}

function detectFormat(rows: unknown[][]): XlsxFormat {
  for (let index = 0; index < Math.min(rows.length, 3); index += 1) {
    const row = rows[index];

    if (!Array.isArray(row)) {
      continue;
    }

    const hasHeaderCell = row.some((cell) => {
      if (typeof cell !== 'string') {
        return false;
      }

      const normalized = normalizeLabel(cell);
      return normalized.includes('sira') || normalized.includes('tanim');
    });

    if (hasHeaderCell) {
      for (let dataIndex = index + 2; dataIndex < Math.min(rows.length, index + 5); dataIndex += 1) {
        const dataRow = rows[dataIndex];
        if (!Array.isArray(dataRow)) {
          continue;
        }

        if (dataRow.some((cell) => typeof cell === 'string' && normalizeLabel(cell).includes('tl'))) {
          return 'string-amounts';
        }
      }

      return 'standard';
    }
  }

  for (let index = 0; index < Math.min(rows.length, 5); index += 1) {
    const row = rows[index];
    if (!Array.isArray(row)) {
      continue;
    }

    if (row.some((cell) => typeof cell === 'string' && normalizeLabel(cell).includes('tl'))) {
      return 'string-amounts';
    }
  }

  return 'no-header';
}

function findHeaderRowIndex(rows: unknown[][]): number {
  for (let index = 0; index < Math.min(rows.length, 10); index += 1) {
    const row = rows[index];

    if (!Array.isArray(row)) {
      continue;
    }

    const hasHeaderCell = row.some((cell) => {
      if (typeof cell !== 'string') {
        return false;
      }

      const normalized = normalizeLabel(cell);
      return normalized.includes('sira') || normalized.includes('tanim');
    });

    if (hasHeaderCell) {
      return index;
    }
  }

  return -1;
}

function isPositiveSequenceValue(value: unknown): boolean {
  const numericValue = parseAmount(value);
  return Number.isInteger(numericValue) && numericValue > 0;
}

function findTutarColumnFromData(rows: unknown[][], dataStartIndex: number): number {
  let maxRowLength = 0;

  for (let index = dataStartIndex; index < Math.min(rows.length, dataStartIndex + 5); index += 1) {
    const row = rows[index];
    if (Array.isArray(row)) {
      maxRowLength = Math.max(maxRowLength, row.length);
    }
  }

  for (let columnIndex = Math.max(maxRowLength - 1, 0); columnIndex >= 5; columnIndex -= 1) {
    for (let rowIndex = dataStartIndex; rowIndex < Math.min(rows.length, dataStartIndex + 5); rowIndex += 1) {
      const row = rows[rowIndex];
      if (!Array.isArray(row)) {
        continue;
      }

      const sampleValue = row[columnIndex];
      if (sampleValue === null || sampleValue === undefined) {
        continue;
      }

      if (typeof sampleValue === 'string' && sampleValue.startsWith('#')) {
        continue;
      }

      const amount = parseAmount(sampleValue);
      if ((typeof sampleValue === 'string' && normalizeLabel(sampleValue).includes('tl')) || amount > 1000) {
        return columnIndex;
      }
    }
  }

  return Math.max(maxRowLength - 1, 0);
}

function extractJsonArray(text: string): unknown[] {
  const trimmed = text.trim();
  const withoutFences = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '');

  try {
    const parsed = JSON.parse(withoutFences) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const start = withoutFences.indexOf('[');
    const end = withoutFences.lastIndexOf(']');

    if (start >= 0 && end > start) {
      const parsed = JSON.parse(withoutFences.slice(start, end + 1)) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    }

    throw new AppError('PDF comparison response was not valid JSON', 502, 'INVALID_PDF_PARSE_RESPONSE');
  }
}

function parseXlsxOffer(filePath: string, tenantId: string, tenantName: string): ParsedOffer {
  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, {
    type: 'buffer',
    cellFormula: false,
    cellNF: false,
    cellText: false,
  });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return {
      tenantId,
      tenantName,
      items: [],
      total: 0,
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true });
  const format = detectFormat(rows);
  const items: ParsedItem[] = [];
  const headerRowIndex = findHeaderRowIndex(rows);

  if (format === 'no-header' || (format === 'string-amounts' && headerRowIndex === -1)) {
    const tutarColIndex = format === 'string-amounts' ? findTutarColumnFromData(rows, 0) : 6;
    let sequentialRowNo = 0;

    for (const row of rows) {
      if (!Array.isArray(row)) {
        continue;
      }

      if (!isPositiveSequenceValue(row[0])) {
        continue;
      }

      const description = String(row[2] ?? '').trim();
      if (!description) {
        continue;
      }

      if (typeof row[tutarColIndex] === 'string' && row[tutarColIndex].startsWith('#')) {
        continue;
      }

      const tutar = parseAmount(row[tutarColIndex]);
      if (tutar <= 0) {
        continue;
      }

      sequentialRowNo += 1;
      items.push({
        siraNo: sequentialRowNo,
        description,
        unit: String(row[3] ?? '').trim(),
        quantity: parseAmount(row[4]),
        malzemeBirimFiyat: null,
        isciliikBirimFiyat: null,
        hasMalzemeIscilikAyri: false,
        tutar,
      });
    }

    return {
      tenantId,
      tenantName,
      items,
      total: items.reduce((sum, item) => sum + item.tutar, 0),
    };
  }

  if (headerRowIndex === -1) {
    return {
      tenantId,
      tenantName,
      items: [],
      total: 0,
    };
  }

  const headerRow = rows[headerRowIndex] ?? [];
  const subHeaderRow = rows[headerRowIndex + 1] ?? [];
  let tutarColIndex = -1;
  let descColIndex = 2;
  let unitColIndex = 3;
  let malzemeColIndex = -1;
  let isciliikColIndex = -1;
  let hasMalzemeIscilikAyri = false;

  for (let columnIndex = 0; columnIndex < headerRow.length; columnIndex += 1) {
    const cell = headerRow[columnIndex];
    if (typeof cell !== 'string') {
      continue;
    }

    const trimmed = cell.trim();
    const normalized = normalizeLabel(trimmed);

    if (normalized === 'tutar') {
      tutarColIndex = columnIndex;
    }

    if (normalized.includes('tanim')) {
      descColIndex = columnIndex;
    }

    if (normalized === 'birim') {
      unitColIndex = columnIndex;
    }
  }

  for (let columnIndex = 0; columnIndex < subHeaderRow.length; columnIndex += 1) {
    const cell = subHeaderRow[columnIndex];
    if (typeof cell !== 'string') {
      continue;
    }

    const normalized = normalizeLabel(cell.trim());
    if (normalized.includes('malzeme')) {
      malzemeColIndex = columnIndex;
    }

    if (normalized.includes('iscilik')) {
      isciliikColIndex = columnIndex;
    }
  }

  if (malzemeColIndex !== -1 || isciliikColIndex !== -1) {
    hasMalzemeIscilikAyri = true;
  }

  if (tutarColIndex === -1) {
    tutarColIndex = Math.max(headerRow.length - 1, 0);
  }

  const dataStartIndex = headerRowIndex + 2;
  if (format === 'string-amounts') {
    tutarColIndex = findTutarColumnFromData(rows, dataStartIndex);
    malzemeColIndex = -1;
    isciliikColIndex = -1;
    hasMalzemeIscilikAyri = false;
  }

  let sequentialRowNo = 0;

  for (let index = dataStartIndex; index < rows.length; index += 1) {
    const row = rows[index];

    if (!Array.isArray(row)) {
      continue;
    }

    const firstCell = row[0];
    if (typeof firstCell === 'string' && normalizeLabel(firstCell).includes('toplam')) {
      continue;
    }

    const description = row[descColIndex];
    if (description === null || description === undefined || String(description).trim() === '') {
      continue;
    }

    const tutarCell = row[tutarColIndex];
    if (typeof tutarCell === 'string' && tutarCell.startsWith('#')) {
      continue;
    }

    const tutar = parseAmount(tutarCell);
    if (tutar <= 0) {
      continue;
    }

    sequentialRowNo += 1;
    const unit = row[unitColIndex] ? String(row[unitColIndex]).trim() : '';
    const quantity = parseAmount(row[4]);
    const malzemeBirimFiyat = malzemeColIndex !== -1 ? parseNullableNumericValue(row[malzemeColIndex]) : null;
    const isciliikBirimFiyat = isciliikColIndex !== -1 ? parseNullableNumericValue(row[isciliikColIndex]) : null;

    items.push({
      siraNo: sequentialRowNo,
      description: String(description).trim(),
      unit,
      quantity,
      malzemeBirimFiyat,
      isciliikBirimFiyat,
      hasMalzemeIscilikAyri,
      tutar,
    });
  }

  const total = items.reduce((sum, item) => sum + item.tutar, 0);

  return {
    tenantId,
    tenantName,
    items,
    total,
  };
}

async function parsePdfOffer(filePath: string, tenantId: string, tenantName: string): Promise<ParsedOffer> {
  const Anthropic = require('@anthropic-ai/sdk').default as typeof import('@anthropic-ai/sdk').default;
  const { env } = require('../../config/env') as typeof import('../../config/env');
  const fileBuffer = fs.readFileSync(filePath);
  const base64 = fileBuffer.toString('base64');
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          },
          {
            type: 'text',
            text: `Extract ALL line items from this construction tender offer PDF.

Return ONLY a JSON array with no explanation:
[
  { "siraNo": 1, "description": "item description", "unit": "m2", "tutar": 12345.67 },
  { "siraNo": 2, "description": "item description", "unit": "mt", "tutar": 9876.54 }
]

Rules:
- siraNo: sequential number starting from 1
- description: the item name/description
- unit: unit of measure (m2, m3, mt, adet, etc.)
- tutar: the TOTAL amount (Tutar column) — NOT unit price (birim fiyat)
- Skip rows with no tutar or tutar = 0
- Skip header rows and total rows
- Return ONLY the JSON array, nothing else`,
          },
        ],
      },
    ],
  });

  const responseText = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
  const parsed = extractJsonArray(responseText) as Array<{
    siraNo?: unknown;
    description?: unknown;
    unit?: unknown;
    tutar?: unknown;
  }>;
  const items: ParsedItem[] = parsed
    .map((item, index) => ({
      siraNo: Number.isInteger(item.siraNo) && Number(item.siraNo) > 0 ? Number(item.siraNo) : index + 1,
      description: String(item.description ?? '').trim(),
      unit: String(item.unit ?? '').trim(),
      quantity: 0,
      malzemeBirimFiyat: null,
      isciliikBirimFiyat: null,
      hasMalzemeIscilikAyri: false,
      tutar: parseAmount(item.tutar),
    }))
    .filter((item) => item.description && item.tutar > 0);

  const total = items.reduce((sum, item) => sum + item.tutar, 0);

  return {
    tenantId,
    tenantName,
    items,
    total,
  };
}

function createEmptyOffer(tenantId: string, tenantName: string): ParsedOffer {
  return {
    tenantId,
    tenantName,
    items: [],
    total: 0,
  };
}

export const runComparison = async (
  tdb: TenantDb,
  tenderId: string,
  userId: string,
  tenantMap: Record<string, string>,
): Promise<{ comparison: comparisonsRepo.TenderComparisonRecord }> => {
  const offerFiles = await offerFilesRepo.findByTenderId(tdb, tenderId);

  if (offerFiles.length < 2) {
    throw new AppError(
      'At least 2 offer files are required for comparison',
      400,
      'INSUFFICIENT_FILES',
    );
  }

  const comparison = await comparisonsRepo.create(tdb, tenderId, userId);

  try {
    const parsedOffers: ParsedOffer[] = [];

    for (const offerFile of offerFiles) {
      const tenantName = tenantMap[offerFile.tenantId] ?? offerFile.tenantName ?? offerFile.tenantId;
      const filePath = path.join(UPLOADS_DIR, offerFile.storedName);

      if (
        offerFile.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        offerFile.mimeType === 'application/vnd.ms-excel'
      ) {
        parsedOffers.push(parseXlsxOffer(filePath, offerFile.tenantId, tenantName));
      } else if (offerFile.mimeType === 'application/pdf') {
        parsedOffers.push(await parsePdfOffer(filePath, offerFile.tenantId, tenantName));
      } else {
        parsedOffers.push(createEmptyOffer(offerFile.tenantId, tenantName));
      }
    }

    const allSiraNumbers = new Set<number>();
    for (const offer of parsedOffers) {
      for (const item of offer.items) {
        allSiraNumbers.add(item.siraNo);
      }
    }

    const rows = Array.from(allSiraNumbers)
      .sort((left, right) => left - right)
      .map((siraNo) => {
        const referenceItem = parsedOffers
          .flatMap((offer) => offer.items)
          .find((item) => item.siraNo === siraNo);

        const prices: Record<string, ComparisonPriceCell> = {};
        const validPrices: Array<{ tenantId: string; tutar: number }> = [];

        for (const offer of parsedOffers) {
          const item = offer.items.find((currentItem) => currentItem.siraNo === siraNo);

          prices[offer.tenantId] = {
            malzemeBirimFiyat: item?.malzemeBirimFiyat ?? null,
            isciliikBirimFiyat: item?.isciliikBirimFiyat ?? null,
            hasMalzemeIscilikAyri: item?.hasMalzemeIscilikAyri ?? false,
            tutar: item?.tutar ?? null,
            isCheapest: false,
            isMostExpensive: false,
          };

          if (item?.tutar !== undefined && item.tutar > 0) {
            validPrices.push({ tenantId: offer.tenantId, tutar: item.tutar });
          }
        }

        if (validPrices.length > 1) {
          const minPrice = Math.min(...validPrices.map((entry) => entry.tutar));
          const maxPrice = Math.max(...validPrices.map((entry) => entry.tutar));

          for (const cell of Object.values(prices)) {
            if (cell.tutar === null || cell.tutar <= 0) {
              continue;
            }

            cell.isCheapest = cell.tutar === minPrice;
            cell.isMostExpensive = cell.tutar === maxPrice;
          }
        }

        return {
          siraNo,
          description: referenceItem?.description ?? `Item ${siraNo}`,
          unit: referenceItem?.unit ?? '',
          prices,
        };
      });

    const totals: Record<string, number> = {};
    for (const offer of parsedOffers) {
      totals[offer.tenantId] = offer.total;
    }

    const cheapestTenantId = Object.entries(totals)
      .filter(([, total]) => total > 0)
      .sort((left, right) => left[1] - right[1])[0]?.[0] ?? null;

    const tenantNames: Record<string, string> = {};
    for (const offer of parsedOffers) {
      tenantNames[offer.tenantId] = offer.tenantName;
    }

    let minimumPossibleTotal = 0;
    let maximumPossibleTotal = 0;
    const tenantStats: ComparisonSummary['tenantStats'] = {};

    for (const offer of parsedOffers) {
      tenantStats[offer.tenantId] = {
        cheapestCount: 0,
        mostExpensiveCount: 0,
        missingItems: 0,
      };
    }

    for (const row of rows) {
      const validPrices = Object.entries(row.prices)
        .filter(([, value]) => value.tutar !== null && value.tutar > 0)
        .map(([tenantId, value]) => ({ tenantId, tutar: value.tutar as number }));

      if (validPrices.length > 0) {
        const minPrice = Math.min(...validPrices.map((price) => price.tutar));
        const maxPrice = Math.max(...validPrices.map((price) => price.tutar));
        minimumPossibleTotal += minPrice;
        maximumPossibleTotal += maxPrice;
      }

      for (const [tenantId, cell] of Object.entries(row.prices)) {
        const stats = tenantStats[tenantId];
        if (!stats) {
          continue;
        }

        if (cell.isCheapest) {
          stats.cheapestCount += 1;
        }

        if (cell.isMostExpensive) {
          stats.mostExpensiveCount += 1;
        }

        if (cell.tutar === null || cell.tutar === 0) {
          stats.missingItems += 1;
        }
      }
    }

    const summary: ComparisonSummary = {
      potentialSavings: maximumPossibleTotal - minimumPossibleTotal,
      minimumPossibleTotal,
      maximumPossibleTotal,
      tenantStats,
    };

    const resultJson: ComparisonResult = {
      rows,
      totals,
      cheapestTenantId,
      tenantNames,
      summary,
    };

    const completed = await comparisonsRepo.updateResult(tdb, comparison.id, resultJson);

    if (!completed) {
      throw new AppError('Comparison could not be saved', 500, 'COMPARISON_SAVE_FAILED');
    }

    return { comparison: completed };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await comparisonsRepo.updateError(tdb, comparison.id, message);
    throw error;
  }
};
