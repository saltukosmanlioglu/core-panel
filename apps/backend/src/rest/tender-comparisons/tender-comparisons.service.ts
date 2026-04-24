import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import * as comparisonsRepo from './tender-comparisons.repo';
import * as offerFilesRepo from '../tender-offer-files/tender-offer-files.repo';
import { AppError } from '../../lib/AppError';
import { env } from '../../config/env';
import { UPLOADS_DIR } from '../../config/paths';
import { TenantDb } from '../../lib/tenantDb';
import type { ComparisonResult, ComparisonRow } from '../../models/tender-comparison.model';

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const withoutFences = trimmed.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');

  try {
    return JSON.parse(withoutFences) as unknown;
  } catch {
    const start = withoutFences.indexOf('{');
    const end = withoutFences.lastIndexOf('}');

    if (start >= 0 && end > start) {
      return JSON.parse(withoutFences.slice(start, end + 1)) as unknown;
    }

    throw new AppError('Anthropic response was not valid JSON', 502, 'INVALID_COMPARISON_RESPONSE');
  }
}

function coercePrice(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'object' && value !== null && 'price' in value) {
    return coercePrice((value as { price?: unknown }).price);
  }

  if (typeof value === 'string') {
    const normalized = value
      .replace(/[^\d,.-]/g, '')
      .replace(/,(?=\d{1,2}$)/, '.')
      .replace(/,/g, '');

    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeResult(
  parsed: unknown,
  tenantIds: string[],
  tenantMap: Record<string, string>,
): ComparisonResult {
  const rawRows = Array.isArray((parsed as { rows?: unknown[] } | null)?.rows)
    ? ((parsed as { rows: unknown[] }).rows)
    : [];

  const rows: ComparisonRow[] = rawRows.map((rawRow) => {
    const source = (rawRow ?? {}) as {
      description?: unknown;
      unit?: unknown;
      prices?: Record<string, unknown>;
    };
    const prices: ComparisonRow['prices'] = {};
    const numericPrices: number[] = [];

    for (const tenantId of tenantIds) {
      const price = coercePrice(source.prices?.[tenantId]);
      prices[tenantId] = {
        price,
        isCheapest: false,
        isMostExpensive: false,
      };

      if (price !== null) {
        numericPrices.push(price);
      }
    }

    if (numericPrices.length > 0) {
      const minPrice = Math.min(...numericPrices);
      const maxPrice = Math.max(...numericPrices);

      for (const tenantId of tenantIds) {
        const cell = prices[tenantId];
        if (cell.price === null) {
          continue;
        }

        cell.isCheapest = cell.price === minPrice;
        cell.isMostExpensive = maxPrice !== minPrice && cell.price === maxPrice;
      }
    }

    return {
      description: String(source.description ?? '').trim() || 'Unknown item',
      unit: String(source.unit ?? '').trim() || '—',
      prices,
    };
  });

  const totals = Object.fromEntries(tenantIds.map((tenantId) => [tenantId, 0])) as Record<string, number>;

  for (const row of rows) {
    for (const tenantId of tenantIds) {
      const price = row.prices[tenantId]?.price;
      if (price !== null && price !== undefined) {
        totals[tenantId] += price;
      }
    }
  }

  const cheapestTenantId = tenantIds.length > 0
    ? tenantIds.reduce<string | null>((cheapest, tenantId) => {
        if (cheapest === null) {
          return tenantId;
        }

        return totals[tenantId] < totals[cheapest] ? tenantId : cheapest;
      }, null)
    : null;

  return {
    rows,
    totals,
    cheapestTenantId,
    tenantNames: Object.fromEntries(tenantIds.map((tenantId) => [tenantId, tenantMap[tenantId] ?? tenantId])),
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
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const tenantIds = offerFiles.map((offerFile) => offerFile.tenantId);

  try {
    const contentBlocks: any[] = [];

    for (const offerFile of offerFiles) {
      const tenantName = tenantMap[offerFile.tenantId] ?? offerFile.tenantName ?? offerFile.tenantId;
      const filePath = path.join(UPLOADS_DIR, offerFile.storedName);
      const fileBuffer = fs.readFileSync(filePath);
      const base64 = fileBuffer.toString('base64');

      contentBlocks.push({
        type: 'text',
        text: `--- Offer from tenant: ${tenantName} (ID: ${offerFile.tenantId}) ---`,
      });

      if (offerFile.mimeType === 'application/pdf') {
        contentBlocks.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64,
          },
        });
      } else {
        contentBlocks.push({
          type: 'text',
          text: `File: ${offerFile.originalName} (${offerFile.mimeType})\nBase64 content: ${base64}`,
        });
      }
    }

    contentBlocks.push({
      type: 'text',
      text: `You are analyzing construction tender offer files from multiple contractors.

Extract all line items from each offer and compare them side by side.

Return ONLY a valid JSON object with this exact structure, no explanation:
{
  "rows": [
    {
      "description": "item description",
      "unit": "unit of measure (m2, m3, adet, mt, etc.)",
      "prices": {
        "<tenantId>": { "price": 1000, "isCheapest": true, "isMostExpensive": false },
        "<tenantId2>": { "price": 1200, "isCheapest": false, "isMostExpensive": true }
      }
    }
  ],
  "totals": {
    "<tenantId>": 50000,
    "<tenantId2>": 65000
  },
  "cheapestTenantId": "<tenantId with lowest total>",
  "tenantNames": {
    "<tenantId>": "Contractor A",
    "<tenantId2>": "Contractor B"
  }
}

Rules:
- Use the exact tenant IDs provided above each file
- Match line items across all offers by their description
- isCheapest: true only for the tenant with the lowest price for that item
- isMostExpensive: true only for the tenant with the highest price for that item
- If a tenant does not have a price for an item, set price to null, isCheapest/isMostExpensive to false
- totals: sum of all non-null prices per tenant
- cheapestTenantId: tenant with the lowest total
- Return ONLY the JSON object, nothing else`,
    });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8096,
      messages: [{ role: 'user', content: contentBlocks }],
    });

    const responseText = message.content
      .filter((block) => block.type === 'text')
      .map((block: any) => block.text)
      .join('');

    const parsed = extractJson(responseText);
    const resultJson = normalizeResult(parsed, tenantIds, tenantMap);
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
