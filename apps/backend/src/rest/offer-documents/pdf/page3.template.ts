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

const DIAGRAM_NAVY = '#164c53';

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

function unitsAreaLabel(units: OfferUnit[]): string | undefined {
  const total = units.reduce((sum, unit) => sum + (Number.isFinite(unit.brutM2) ? unit.brutM2 : 0), 0);
  return total > 0 ? formatM2(total) : undefined;
}

function floorLabelHtml(label: string, areaLabel?: string): string {
  return `
    <div class="floor-label">
      <span class="floor-label-main">${escapeHtml(label)}</span>
      ${areaLabel ? `<span class="floor-label-area">${escapeHtml(areaLabel)}</span>` : ''}
    </div>
  `;
}

function unitsRowHtml(units: OfferUnit[], label: string, streetLabels?: StreetLabels, rowClass = ''): string {
  const classes = ['floor-row', rowClass].filter(Boolean).join(' ');
  return `
    <div class="${classes}">
      ${streetLabelsHtml(streetLabels)}
      <div class="floor-cells">
        ${units.length > 0 ? units.map(unitHtml).join('') : '<div class="empty-unit">Birim eklenmedi</div>'}
      </div>
      ${floorLabelHtml(label, unitsAreaLabel(units))}
    </div>
    ${bottomStreetHtml(streetLabels)}
  `;
}

function normalFloorHtml(floor: NormalFloor): string {
  return unitsRowHtml(floor.units, `${floor.floorNumber}.NORMAL KAT`, undefined, 'normal-floor');
}

function basementFloorHtml(floor: BasementFloor): string {
  if (floor.isCommonArea) {
    return `
      <div class="floor-row basement basement-common">
        ${streetLabelsHtml(floor.streetLabels)}
        <div class="floor-cells">
          <div class="common-area">
            <strong>${escapeHtml(formatM2(floor.commonAreaM2))}</strong>
            <span>${escapeHtml(floor.commonAreaLabel ?? 'ORTAK ALAN')}</span>
          </div>
        </div>
      </div>
      ${bottomStreetHtml(floor.streetLabels)}
    `;
  }

  return unitsRowHtml(floor.units, floor.label, floor.streetLabels, 'basement basement-units');
}

export function page3Html(offerDocument: OfferDocument, subtitleLine?: string): string {
  const building = offerDocument.building;
  const floors = [
    ...(building.roofFloor.exists ? [unitsRowHtml(building.roofFloor.units, 'ÇATI KATI', undefined, 'roof-floor')] : []),
    ...building.normalFloors.slice().reverse().map(normalFloorHtml),
    ...(building.groundFloor.exists ? [unitsRowHtml(building.groundFloor.units, 'ZEMİN KAT', building.groundFloor.streetLabels, 'ground-floor')] : []),
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
            border: 2px solid ${DIAGRAM_NAVY};
            padding: 4mm 6mm 6mm;
            background: white;
            page-break-inside: avoid;
          }
          .roof-shape {
            width: 100%;
            margin: 0 auto;
          }
          .roofbase {
            border-bottom: 12px solid ${DIAGRAM_NAVY};
            width: 100%;
            height: 0;
            margin-bottom: 1.5mm;
          }
          .floor-row {
            height: auto;
            min-height: 22mm;
            display: grid;
            grid-template-columns: minmax(0, 1fr) 28mm;
            border-top: 2px solid ${DIAGRAM_NAVY};
            position: relative;
          }
          .floor-row.ground-floor {
            margin-left: 50px;
            margin-right: 50px;
            grid-template-columns: minmax(0, 1fr) 25mm;
          }
          .floor-row.basement {
            border-bottom: 12px solid ${DIAGRAM_NAVY};
          }
          .floor-row.basement-common {
            grid-template-columns: minmax(0, 1fr);
          }
          .floor-cells {
            display: flex;
            align-items: stretch;
            gap: 0;
            padding: 0;
            min-width: 0;
          }
          .floor-label {
            border-left: 2px solid ${DIAGRAM_NAVY};
            color: ${DIAGRAM_NAVY};
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            font-size: 13px;
            font-weight: 900;
            text-decoration: underline;
            line-height: 1.15;
            padding: 1mm;
          }
          .floor-label-area {
            display: block;
            margin-top: 1mm;
            font-size: 12px;
            font-weight: 900;
            text-decoration: none;
          }
          .unit,
          .empty-unit,
          .common-area {
            min-height: 20mm;
            flex: 1 1 0;
            position: relative;
            padding: 2mm 2mm 6mm;
            font-size: 8px;
            line-height: 1.25;
            overflow: hidden;
            border-right: 2px solid ${DIAGRAM_NAVY};
          }
          .unit.mila {
            background: ${DIAGRAM_NAVY};
            color: white;
            border-color: ${DIAGRAM_NAVY};
          }
          .unit.tapu,
          .empty-unit,
          .common-area {
            background: white;
            color: ${DIAGRAM_NAVY};
            border: 2px solid ${DIAGRAM_NAVY};
          }
          .unit.null-owner {
            background: #f0f0f0;
            border: 2px dashed ${DIAGRAM_NAVY};
            color: ${DIAGRAM_NAVY};
            text-align: center;
          }
          .floor-row.ground-floor .unit,
          .floor-row.ground-floor .empty-unit,
          .floor-row.ground-floor .common-area,
          .floor-row.basement-units .unit,
          .floor-row.basement-units .empty-unit {
            min-height: 16mm;
            font-size: 7px;
            padding: 1.5mm 1.5mm 5mm;
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
            background: ${DIAGRAM_NAVY};
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 8px;
            font-weight: 900;
            border-radius: 1mm;
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
            font-weight: 900;
          }
          .basement-common .floor-cells {
            width: 100%;
          }
          .basement-common .common-area {
            min-height: 18mm;
            width: 100%;
            border: 0;
            border-right: 0;
            font-size: 13px;
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
          <div class="subtitle">${escapeHtml(subtitleLine ?? 'KAT MALİKLERİ PAYLAŞIM KROKİSİ')}</div>
          <section class="building-shell">
            <div class="roof-shape">
              <svg viewBox="0 0 982 95" preserveAspectRatio="none" style="width:100%;height:60px;display:block;">
                <path d="M0,84 L491,10 L982,84" stroke="${DIAGRAM_NAVY}" stroke-width="8" fill="none" stroke-linejoin="miter"/>
              </svg>
              <div class="roofbase"></div>
            </div>
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
