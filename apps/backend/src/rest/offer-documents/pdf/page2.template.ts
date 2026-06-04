import type { OfferDocument } from '../offer-documents.repo';
import { baseStyles, escapeHtml, footerHtml, NAVY } from './template-utils';

export function page2Html(offerDocument: OfferDocument): string {
  return `
    <!doctype html>
    <html lang="tr">
      <head>
        <meta charset="utf-8" />
        <style>
          ${baseStyles()}
          .content {
            margin-top: 8mm;
            font-size: 12px;
            line-height: 1.65;
            color: #111827;
          }
          .content p { margin: 0 0 3mm; }
          .content ul, .content ol { margin: 0 0 3mm; padding-left: 5mm; }
          .content li { margin-bottom: 1mm; }
          .content h1 { font-size: 14px; font-weight: 800; margin: 3mm 0 2mm; }
          .content h2 { font-size: 13px; font-weight: 800; margin: 2mm 0 1.5mm; }
          .rate {
            position: absolute;
            left: 18mm;
            bottom: 34mm;
            color: ${NAVY};
            font-size: 12px;
            font-weight: 700;
          }
          .signature {
            position: absolute;
            right: 18mm;
            bottom: 32mm;
            text-align: center;
            color: #111827;
            font-size: 12px;
            line-height: 1.45;
          }
          .signature strong {
            color: ${NAVY};
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <main class="page">
          <header class="mila-header">
            <div>
              <div class="brand">${escapeHtml(offerDocument.companyName)}</div>
              <div class="brand-subtitle">Teklif İçeriği</div>
            </div>
          </header>

          <section class="content">${offerDocument.page2Content}</section>

          <div class="rate">${escapeHtml(offerDocument.tcmbRate)}</div>
          <div class="signature">
            <strong>İhsan Safa OSMANLIOĞLU</strong><br />
            İnşaat Yüksek Mühendisi
          </div>
          ${footerHtml(offerDocument.companyName)}
        </main>
      </body>
    </html>
  `;
}
