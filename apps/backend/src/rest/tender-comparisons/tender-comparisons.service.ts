import fs from 'fs/promises';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env';
import { UPLOADS_DIR } from '../../config/paths';
import { TenantDb } from '../../lib/tenantDb';
import { AppError } from '../../lib/AppError';
import type { ComparisonResult } from '../../models/tender-comparison.model';
import * as tenantsRepo from '../tenants/tenants.repo';
import * as tenderOfferFilesRepo from '../tender-offer-files/tender-offer-files.repo';
import * as tenderComparisonsRepo from './tender-comparisons.repo';

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

function buildPrompt(files: Array<{
  tenantId: string;
  tenantName: string | null;
  originalName: string;
  mimeType: string;
  base64: string;
}>): string {
  const sections = files.map((file) => [
    `Tenant ID: ${file.tenantId}`,
    `Tenant Name: ${file.tenantName ?? file.tenantId}`,
    `File Name: ${file.originalName}`,
    `Mime Type: ${file.mimeType}`,
    `Base64 Content: ${file.base64}`,
  ].join('\n'));

  return [
    'You are analyzing tender offer files from multiple contractors.',
    'Extract line items and compare prices across every tenant.',
    'Return ONLY valid JSON with this exact shape:',
    '{',
    '  "items": [',
    '    {',
    '      "description": "item description",',
    '      "unit": "unit of measure",',
    '      "prices": { "tenant-id": 1000 },',
    '      "cheapestTenantId": "tenant-id",',
    '      "mostExpensiveTenantId": "tenant-id"',
    '    }',
    '  ],',
    '  "totals": { "tenant-id": 50000 },',
    '  "cheapestTenantId": "tenant-id",',
    '  "tenantNames": { "tenant-id": "Contractor Name" }',
    '}',
    'Rules:',
    '- Match equivalent line items across all offers by description.',
    '- Use numeric values only inside prices and totals.',
    '- cheapestTenantId is the tenant with the lowest price for that item.',
    '- mostExpensiveTenantId is the tenant with the highest price for that item.',
    '- totals is the grand total per tenant.',
    '- Do not include markdown, code fences, or explanations.',
    '',
    ...sections,
  ].join('\n');
}

function extractJson(text: string): ComparisonResult {
  const trimmed = text.trim();
  const withoutFences = trimmed.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');

  try {
    return JSON.parse(withoutFences) as ComparisonResult;
  } catch {
    const start = withoutFences.indexOf('{');
    const end = withoutFences.lastIndexOf('}');

    if (start >= 0 && end > start) {
      return JSON.parse(withoutFences.slice(start, end + 1)) as ComparisonResult;
    }

    throw new AppError('Anthropic response was not valid JSON', 502, 'INVALID_COMPARISON_RESPONSE');
  }
}

export async function runComparison(companyId: string, tenderId: string, comparisonId: string): Promise<void> {
  const tdb = new TenantDb(companyId);

  try {
    const offerFiles = await tenderOfferFilesRepo.findByTenderId(tdb, tenderId);

    if (offerFiles.length < 2) {
      throw new AppError('At least 2 offer files are required for comparison', 400, 'INSUFFICIENT_FILES');
    }

    const tenants = await tenantsRepo.findAllByCompanyId(companyId);
    const tenantNames = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));

    const files = await Promise.all(
      offerFiles.map(async (offerFile) => {
        const base64 = await fs.readFile(path.join(UPLOADS_DIR, offerFile.storedName), 'base64');

        return {
          tenantId: offerFile.tenantId,
          tenantName: tenantNames.get(offerFile.tenantId) ?? offerFile.tenantName ?? offerFile.tenantId,
          originalName: offerFile.originalName,
          mimeType: offerFile.mimeType,
          base64,
        };
      }),
    );

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: buildPrompt(files),
        },
      ],
    });

    const responseText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const resultJson = extractJson(responseText);
    await tenderComparisonsRepo.updateResult(tdb, comparisonId, resultJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Comparison failed';
    await tenderComparisonsRepo.updateError(tdb, comparisonId, message);
  }
}
