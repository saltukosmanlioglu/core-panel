import type { OfferDocument } from '../offer-documents.repo';
import { baseStyles, escapeHtml, footerHtml, formatDate, NAVY } from './template-utils';

export function page1Html(offerDocument: OfferDocument): string {
  return `
    <!doctype html>
    <html lang="tr">
      <head>
        <meta charset="utf-8" />
        <style>
          ${baseStyles()}
          .parcel-box {
            text-align: right;
            font-size: 12px;
            line-height: 1.5;
            max-width: 78mm;
          }
          .hero {
            height: 190mm;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
          }
          .hero-mark {
            width: 34mm;
            height: 4mm;
            background: ${NAVY};
            margin-bottom: 14mm;
          }
          h1 {
            margin: 0;
            color: ${NAVY};
            font-size: 35px;
            line-height: 1.18;
            font-weight: 900;
          }
          .subline {
            margin-top: 8mm;
            color: #374151;
            font-size: 15px;
            letter-spacing: 0;
          }
        </style>
      </head>
      <body>
        <main class="page">
          <header class="mila-header">
            <div>
              <div class="brand">${escapeHtml(offerDocument.companyName)}</div>
              <div class="brand-subtitle">İnşaat Yapım Teklifi</div>
            </div>
            <div class="parcel-box">
              <strong>${escapeHtml(offerDocument.parcelTitle)}</strong><br />
              ${escapeHtml(formatDate(offerDocument.offerDate))}
            </div>
          </header>

          <section class="hero">
            <div class="hero-mark"></div>
            <h1>İNŞAAT YAPIM<br />TEKLİFİ</h1>
            <div class="subline">${escapeHtml(offerDocument.parcelTitle)}</div>
          </section>

          ${footerHtml(offerDocument.companyName)}
        </main>
      </body>
    </html>
  `;
}
