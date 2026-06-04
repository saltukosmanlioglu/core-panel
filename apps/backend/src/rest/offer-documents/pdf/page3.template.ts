import type {
  BasementFloor,
  NormalFloor,
  OfferDocument,
  OfferUnit,
  StreetLabels,
} from '../offer-documents.repo';
import {
  baseStyles,
  escapeHtml,
  footerHtml,
  formatM2,
  NAVY,
  unitHtml,
} from './template-utils';

function streetLabelsHtml(labels?: StreetLabels): string {
  if (!labels) return '';
  return `
    ${labels.left ? `<div class="street street-left">${escapeHtml(labels.left)}</div>` : ''}
    ${labels.right ? `<div class="street street-right">${escapeHtml(labels.right)}</div>` : ''}
  `;
}

function bottomStreetHtml(labels?: StreetLabels): string {
  return labels?.bottom ? `<div class="street-bottom">${escapeHtml(labels.bottom)}</div>` : '';
}

function unitsRowHtml(units: OfferUnit[], label: string, streetLabels?: StreetLabels): string {
  return `
    <div class="floor-row">
      ${streetLabelsHtml(streetLabels)}
      <div class="floor-cells">
        ${units.length > 0 ? units.map(unitHtml).join('') : '<div class="empty-unit">Birim eklenmedi</div>'}
      </div>
      <div class="floor-label">${escapeHtml(label)}</div>
    </div>
    ${bottomStreetHtml(streetLabels)}
  `;
}

function normalFloorHtml(floor: NormalFloor): string {
  return unitsRowHtml(floor.units, `${floor.floorNumber}.NORMAL KAT`);
}

function basementFloorHtml(floor: BasementFloor): string {
  if (floor.isCommonArea) {
    return `
      <div class="floor-row basement">
        ${streetLabelsHtml(floor.streetLabels)}
        <div class="floor-cells">
          <div class="common-area">
            <strong>${escapeHtml(formatM2(floor.commonAreaM2))}</strong>
            <span>${escapeHtml(floor.commonAreaLabel ?? 'ORTAK ALAN')}</span>
          </div>
        </div>
        <div class="floor-label">${escapeHtml(floor.label)}</div>
      </div>
      ${bottomStreetHtml(floor.streetLabels)}
    `;
  }

  return unitsRowHtml(floor.units, floor.label, floor.streetLabels);
}

export function page3Html(offerDocument: OfferDocument): string {
  const building = offerDocument.building;
  const floors = [
    ...(building.roofFloor.exists ? [unitsRowHtml(building.roofFloor.units, 'ÇATI KATI')] : []),
    ...building.normalFloors.slice().reverse().map(normalFloorHtml),
    ...(building.groundFloor.exists ? [unitsRowHtml(building.groundFloor.units, 'ZEMİN KAT', building.groundFloor.streetLabels)] : []),
    ...building.basementFloors.map(basementFloorHtml),
  ];

  return `
    <!doctype html>
    <html lang="tr">
      <head>
        <meta charset="utf-8" />
        <style>
          ${baseStyles()}
          .page {
            padding: 12mm 13mm 22mm;
          }
          .diagram-title {
            background: ${NAVY};
            color: white;
            text-align: center;
            font-size: 16px;
            font-weight: 900;
            padding: 4mm 6mm;
            margin-bottom: 4mm;
          }
          .subtitle {
            text-align: center;
            color: ${NAVY};
            font-size: 14px;
            font-weight: 900;
            margin-bottom: 5mm;
          }
          .building-shell {
            border: 2px solid ${NAVY};
            padding: 4mm 6mm 6mm;
            background: white;
            page-break-inside: avoid;
          }
          .roof-shape {
            width: 76%;
            margin: 0 auto 2mm;
            height: 18mm;
            position: relative;
          }
          .roof-shape::before {
            content: "";
            position: absolute;
            inset: 0;
            clip-path: polygon(50% 0, 100% 100%, 0 100%);
            border: 2px solid ${NAVY};
            background: #f8fafc;
          }
          .floor-row {
            min-height: 22mm;
            display: grid;
            grid-template-columns: minmax(0, 1fr) 24mm;
            border-top: 1px solid ${NAVY};
            position: relative;
          }
          .floor-row:first-of-type {
            border-top-width: 2px;
          }
          .floor-cells {
            display: flex;
            gap: 1.5mm;
            padding: 1.5mm;
            min-width: 0;
          }
          .floor-label {
            border-left: 1px solid ${NAVY};
            color: ${NAVY};
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            font-size: 9px;
            font-weight: 800;
            padding: 1mm;
          }
          .unit,
          .empty-unit,
          .common-area {
            min-height: 18mm;
            flex: 1 1 0;
            position: relative;
            padding: 2mm 2mm 5mm;
            font-size: 8px;
            line-height: 1.25;
            overflow: hidden;
          }
          .unit.mila {
            background: ${NAVY};
            color: white;
          }
          .unit.tapu,
          .empty-unit,
          .common-area {
            background: white;
            color: #111827;
            border: 1px solid ${NAVY};
          }
          .unit.null-owner {
            background: #f0f0f0;
            border: 1px solid #aaa;
            color: #444;
            text-align: center;
          }
          .unit-owner {
            font-weight: 900;
            margin-bottom: 1mm;
          }
          .unit-area,
          .unit-payment {
            font-weight: 700;
          }
          .unit-badge {
            position: absolute;
            right: 1mm;
            bottom: 1mm;
            min-width: 5mm;
            height: 5mm;
            background: ${NAVY};
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 8px;
            font-weight: 900;
          }
          .unit.mila .unit-badge {
            background: white;
            color: ${NAVY};
          }
          .unit-label {
            position: absolute;
            left: 2mm;
            bottom: 1.4mm;
            font-size: 7px;
            font-weight: 700;
          }
          .unit-linked {
            font-size: 7px;
            font-style: italic;
            margin-top: 0.5mm;
            opacity: 0.85;
          }
          .common-area {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            gap: 1mm;
            font-size: 10px;
          }
          .street {
            position: absolute;
            top: 50%;
            color: #374151;
            font-size: 7px;
            font-weight: 700;
            white-space: nowrap;
          }
          .street-left {
            left: -8mm;
            transform: translateY(-50%) rotate(-90deg);
          }
          .street-right {
            right: -8mm;
            transform: translateY(-50%) rotate(90deg);
          }
          .street-bottom {
            color: #374151;
            text-align: center;
            font-size: 8px;
            font-weight: 700;
            padding-top: 1mm;
          }
          .campaign-note {
            margin-top: 4mm;
            color: #c2410c;
            font-size: 10px;
            font-weight: 700;
            text-align: center;
          }
          .footer {
            left: 13mm;
            right: 13mm;
            bottom: 7mm;
          }
        </style>
      </head>
      <body>
        <main class="page">
          <div class="diagram-title">${escapeHtml(offerDocument.parcelTitle)}</div>
          <div class="subtitle">KAT MALİKLERİ PAYLAŞIM KROKİSİ</div>
          <section class="building-shell">
            <div class="roof-shape"></div>
            ${floors.join('')}
          </section>
          <div class="campaign-note">
            Teklifimiz güncel maliyet koşulları dikkate alınarak hazırlanmıştır.
          </div>
          ${footerHtml(offerDocument.companyName)}
        </main>
      </body>
    </html>
  `;
}
