import ExcelJS from 'exceljs';
import { NextFunction, Request, Response } from 'express';
import { TenantDb } from '../../lib/tenantDb';
import * as projectsRepo from '../projects/projects.repo';
import * as tendersRepo from '../tenders/tenders.repo';
import * as awardsRepo from '../tender-awards/tender-awards.repo';
import * as comparisonsRepo from '../tender-comparisons/tender-comparisons.repo';
import * as tenderItemsRepo from '../tender-items/tender-items.repo';
import * as tenantsRepo from '../tenants/tenants.repo';
import type { PriceList, PriceListTenant } from '@core-panel/shared';

async function buildPriceList(companyId: string, projectId: string, kdvRate: number): Promise<PriceList> {
  const tdb = new TenantDb(companyId);

  const allTenders = await tendersRepo.findAll(companyId, { projectId });
  const awardedTenders = allTenders.filter((t) => t.status === 'awarded');

  const tenantMap = new Map<string, PriceListTenant>();

  for (const tender of awardedTenders) {
    const [awardItems, comparison, tenderItems] = await Promise.all([
      awardsRepo.findByTenderId(tdb, tender.id),
      comparisonsRepo.findLatestByTenderId(tdb, tender.id),
      tenderItemsRepo.findByTenderId(tdb, tender.id),
    ]);

    const awarded = awardItems.filter((item) => item.status === 'awarded' && item.awardedTenantId);
    if (awarded.length === 0) continue;

    const compRows = comparison?.resultJson?.rows ?? [];
    const quantityMap = new Map(tenderItems.map((ti) => [ti.rowNo, ti.quantity]));

    for (const award of awarded) {
      const tenantId = award.awardedTenantId!;
      const compRow = compRows.find((r) => r.siraNo === award.siraNo);
      const unitPrice = compRow?.prices[tenantId]?.tutar ?? 0;
      const quantity = quantityMap.get(award.siraNo) ?? 0;
      const description = award.description ?? compRow?.description ?? `Kalem ${award.siraNo}`;
      const unit = compRow?.unit ?? '';
      const total = unitPrice * quantity;

      if (!tenantMap.has(tenantId)) {
        const tenant = await tenantsRepo.findById(tenantId);
        tenantMap.set(tenantId, {
          tenantId,
          tenantName: tenant?.name ?? tenantId,
          contactName: tenant?.contactName ?? null,
          total: 0,
          totalWithKdv: 0,
          tenders: [],
        });
      }

      const tenantEntry = tenantMap.get(tenantId)!;
      let tenderEntry = tenantEntry.tenders.find((t) => t.tenderId === tender.id);

      if (!tenderEntry) {
        tenderEntry = {
          tenderId: tender.id,
          tenderTitle: tender.title,
          categoryName: tender.categoryName ?? null,
          status: tender.status,
          items: [],
          tenderTotal: 0,
        };
        tenantEntry.tenders.push(tenderEntry);
      }

      tenderEntry.items.push({
        siraNo: award.siraNo,
        description,
        unit,
        quantity,
        unitPrice,
        total,
        note: award.note,
      });
      tenderEntry.tenderTotal += total;
    }
  }

  let grandTotal = 0;
  const tenants: PriceListTenant[] = [];

  for (const tenant of tenantMap.values()) {
    tenant.tenders.forEach((t) => {
      t.items.sort((a, b) => a.siraNo - b.siraNo);
    });
    tenant.total = tenant.tenders.reduce((sum, t) => sum + t.tenderTotal, 0);
    tenant.totalWithKdv = tenant.total * (1 + kdvRate / 100);
    grandTotal += tenant.total;
    tenants.push(tenant);
  }

  tenants.sort((a, b) => a.tenantName.localeCompare(b.tenantName, 'tr'));

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    grandTotal,
    grandTotalWithKdv: grandTotal * (1 + kdvRate / 100),
    kdvRate,
    tenants,
  };
}

export const getPriceList = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.resolvedCompanyId!;
    const projectId = String(req.params.projectId);

    const project = await projectsRepo.findById(companyId, projectId);
    if (!project) {
      res.status(404).json({ error: 'İnşaat bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const kdvRate = Math.max(0, Math.min(100, Number(req.query.kdvRate) || 20));
    const data = await buildPriceList(companyId, projectId, kdvRate);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const exportPriceList = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.resolvedCompanyId!;
    const projectId = String(req.params.projectId);

    const project = await projectsRepo.findById(companyId, projectId);
    if (!project) {
      res.status(404).json({ error: 'İnşaat bulunamadı', code: 'NOT_FOUND' });
      return;
    }

    const kdvRate = Math.max(0, Math.min(100, Number(req.query.kdvRate) || 20));
    const data = await buildPriceList(companyId, projectId, kdvRate);

    const wb = new ExcelJS.Workbook();
    wb.created = new Date();

    const tl = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const currencyFmt = '#,##0.00 ₺';

    function applyHeaderStyle(row: ExcelJS.Row) {
      row.font = { bold: true };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
    }

    // Sheet 1: Özet
    const summary = wb.addWorksheet('Özet');
    summary.columns = [
      { header: 'Taşeron', key: 'tenant', width: 32 },
      { header: 'Tutar (KDV Hariç)', key: 'base', width: 22 },
      { header: `KDV (%${kdvRate})`, key: 'kdv', width: 20 },
      { header: 'Genel Toplam', key: 'total', width: 22 },
    ];
    applyHeaderStyle(summary.getRow(1));

    for (const tenant of data.tenants) {
      const kdvAmt = tenant.total * (kdvRate / 100);
      summary.addRow({
        tenant: tenant.tenantName,
        base: tenant.total,
        kdv: kdvAmt,
        total: tenant.totalWithKdv,
      });
    }

    const grandKdv = data.grandTotal * (kdvRate / 100);
    const grandRow = summary.addRow({
      tenant: 'GENEL TOPLAM',
      base: data.grandTotal,
      kdv: grandKdv,
      total: data.grandTotalWithKdv,
    });
    grandRow.font = { bold: true };
    grandRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC8E6C9' } };

    summary.eachRow((row, rowNum) => {
      if (rowNum > 1) {
        ['B', 'C', 'D'].forEach((col) => {
          const cell = summary.getCell(`${col}${rowNum}`);
          if (typeof cell.value === 'number') cell.numFmt = currencyFmt;
        });
      }
    });

    // Sheet 2: Detay
    const detail = wb.addWorksheet('Detay');
    detail.columns = [
      { header: 'Taşeron', key: 'tenant', width: 28 },
      { header: 'İhale', key: 'tender', width: 30 },
      { header: 'Sıra No', key: 'siraNo', width: 10 },
      { header: 'Açıklama', key: 'description', width: 40 },
      { header: 'Birim', key: 'unit', width: 10 },
      { header: 'Miktar', key: 'quantity', width: 12 },
      { header: 'Birim Fiyat', key: 'unitPrice', width: 16 },
      { header: 'Toplam', key: 'total', width: 18 },
    ];
    applyHeaderStyle(detail.getRow(1));

    for (const tenant of data.tenants) {
      for (const tender of tenant.tenders) {
        for (const item of tender.items) {
          detail.addRow({
            tenant: tenant.tenantName,
            tender: tender.tenderTitle,
            siraNo: item.siraNo,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          });
        }

        const tenderSumRow = detail.addRow({
          tenant: tenant.tenantName,
          tender: `${tender.tenderTitle} TOPLAM`,
          total: tender.tenderTotal,
        });
        tenderSumRow.font = { bold: true, italic: true };
        tenderSumRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECEFF1' } };
      }

      const tenantSumRow = detail.addRow({
        tenant: `${tenant.tenantName} — TAŞERON TOPLAM`,
        total: tenant.total,
      });
      tenantSumRow.font = { bold: true };
      tenantSumRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
    }

    const detailGrandRow = detail.addRow({ tenant: 'GENEL TOPLAM', total: data.grandTotal });
    detailGrandRow.font = { bold: true };
    detailGrandRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC8E6C9' } };

    detail.eachRow((row, rowNum) => {
      if (rowNum > 1) {
        ['G', 'H'].forEach((col) => {
          const cell = detail.getCell(`${col}${rowNum}`);
          if (typeof cell.value === 'number') cell.numFmt = currencyFmt;
        });
      }
    });

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="price-list-${projectId}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    next(error);
  }
};
