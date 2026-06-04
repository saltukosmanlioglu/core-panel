import type { OfferUnit } from '../offer-documents.repo';

export const NAVY = '#1B3A5C';

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatM2(value: number | null | undefined): string {
  return `${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0)} m²`;
}

export function formatTry(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function baseStyles(): string {
  return `
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
      background: #fff;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 16mm 18mm;
      position: relative;
      overflow: hidden;
      background: white;
    }
    .mila-header {
      background: ${NAVY};
      color: white;
      padding: 11mm 12mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: -16mm -18mm 0;
    }
    .brand {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 0;
    }
    .brand-subtitle {
      font-size: 11px;
      opacity: .88;
      margin-top: 3px;
    }
    .footer {
      position: absolute;
      left: 18mm;
      right: 18mm;
      bottom: 10mm;
      border-top: 1px solid #d1d5db;
      padding-top: 5mm;
      display: flex;
      justify-content: space-between;
      gap: 8mm;
      color: #4b5563;
      font-size: 10px;
      line-height: 1.45;
    }
    .footer-brand {
      color: ${NAVY};
      font-weight: 800;
      font-size: 15px;
    }
    @media print {
      .page { page-break-after: always; }
    }
  `;
}

export function footerHtml(companyName: string): string {
  return `
    <div class="footer">
      <div>
        <div class="footer-brand">${escapeHtml(companyName)}</div>
        <div>İnşaat ve Gayrimenkul Geliştirme</div>
      </div>
      <div>
        <div>www.milainsaat.com</div>
        <div>info@milainsaat.com</div>
      </div>
    </div>
  `;
}

export function unitHtml(unit: OfferUnit): string {
  const isMila = unit.ownerType === 'mila';
  const isNullOwner = unit.ownerType === null;
  const cssClass = isMila ? 'mila' : isNullOwner ? 'null-owner' : 'tapu';
  const payment = unit.ownerType === 'tapu' && unit.paymentAmount != null
    ? `<div class="unit-payment">Ödeme: ${escapeHtml(formatTry(unit.paymentAmount))}</div>`
    : '';
  const label = unit.label ? `<div class="unit-label">${escapeHtml(unit.label)}</div>` : '';
  const badgeNumber = unit.unitNumber != null ? unit.unitNumber : unit.id;
  const linkedLabel = unit.linkedUnitLabel
    ? `<div class="unit-linked">${escapeHtml(unit.linkedUnitLabel)}</div>`
    : '';
  return `
    <div class="unit ${cssClass}">
      <div class="unit-owner">${escapeHtml(unit.ownerName)}</div>
      <div class="unit-area">Brüt: ${escapeHtml(formatM2(unit.brutM2))}</div>
      ${payment}
      <div class="unit-badge">${escapeHtml(badgeNumber)}</div>
      ${linkedLabel}
      ${label}
    </div>
  `;
}
