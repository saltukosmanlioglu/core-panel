import { AppError } from '../../lib/AppError';
import { TenantDb } from '../../lib/tenantDb';
import * as auditRepo from '../tender-audit-logs/tender-audit-logs.repo';
import * as comparisonsRepo from '../tender-comparisons/tender-comparisons.repo';

export type RecommendationType =
  | 'strongly_recommended'
  | 'recommended'
  | 'close_price'
  | 'negotiate'
  | 'no_competition'
  | 'missing';

export interface ItemRecommendation {
  siraNo: number;
  description: string;
  unit: string;
  recommendedTenantId: string | null;
  recommendationType: RecommendationType;
  recommendationNote: string;
  priceDiffPercent: number | null;
}

export async function getRecommendations(tdb: TenantDb, tenderId: string): Promise<ItemRecommendation[]> {
  const comparison = await comparisonsRepo.findLatestByTenderId(tdb, tenderId);
  const result = comparison?.resultJson;

  if (!result) {
    return [];
  }

  const recommendations: ItemRecommendation[] = [];

  for (const row of result.rows) {
    const validPrices = Object.entries(row.prices)
      .filter(([, value]) => value.tutar !== null && value.tutar > 0)
      .map(([tenantId, value]) => ({ tenantId, tutar: value.tutar as number }))
      .sort((left, right) => left.tutar - right.tutar);

    if (validPrices.length === 0) {
      recommendations.push({
        siraNo: row.siraNo,
        description: row.description,
        unit: row.unit,
        recommendedTenantId: null,
        recommendationType: 'missing',
        recommendationNote: 'Bu kalem için hiçbir teklif alınmamış',
        priceDiffPercent: null,
      });
      continue;
    }

    if (validPrices.length === 1) {
      recommendations.push({
        siraNo: row.siraNo,
        description: row.description,
        unit: row.unit,
        recommendedTenantId: validPrices[0].tenantId,
        recommendationType: 'no_competition',
        recommendationNote: 'Tek teklif — müzakere edin',
        priceDiffPercent: null,
      });
      continue;
    }

    const cheapest = validPrices[0];
    const mostExpensive = validPrices[validPrices.length - 1];
    const diffPercent = ((mostExpensive.tutar - cheapest.tutar) / cheapest.tutar) * 100;

    let recommendationType: RecommendationType;
    let recommendationNote: string;

    if (diffPercent < 5) {
      recommendationType = 'close_price';
      recommendationNote = `Fiyatlar çok yakın (%${diffPercent.toFixed(1)} fark) — tercih edin`;
    } else if (diffPercent < 15) {
      recommendationType = 'recommended';
      recommendationNote = `${result.tenantNames[cheapest.tenantId]} önerilir (%${diffPercent.toFixed(1)} daha ucuz)`;
    } else if (diffPercent < 40) {
      recommendationType = 'strongly_recommended';
      recommendationNote = `${result.tenantNames[cheapest.tenantId]} kesinlikle önerilir (%${diffPercent.toFixed(1)} daha ucuz)`;
    } else {
      recommendationType = 'strongly_recommended';
      recommendationNote = `${result.tenantNames[cheapest.tenantId]} kesinlikle önerilir (%${diffPercent.toFixed(1)} fark — çok büyük fiyat uçurumu)`;
    }

    recommendations.push({
      siraNo: row.siraNo,
      description: row.description,
      unit: row.unit,
      recommendedTenantId: cheapest.tenantId,
      recommendationType,
      recommendationNote,
      priceDiffPercent: diffPercent,
    });
  }

  return recommendations;
}

export async function finalizeTender(
  tdb: TenantDb,
  tenderId: string,
  userId: string,
  note?: string,
): Promise<{ status: 'awarded' }> {
  const { rowCount } = await tdb.query(
    `UPDATE ${tdb.ref('tenders')}
     SET status = 'awarded', updated_at = NOW()
     WHERE id = $1`,
    [tenderId],
  );

  if (rowCount === 0) {
    throw new AppError('İhale bulunamadı', 404, 'NOT_FOUND');
  }

  await auditRepo.create(
    tdb,
    tenderId,
    'tender_finalized',
    {
      note: note ?? null,
      finalizedBy: userId,
    },
    userId,
  );

  return { status: 'awarded' };
}
