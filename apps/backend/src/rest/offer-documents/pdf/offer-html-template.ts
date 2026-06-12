import type {
  OfferDocument,
  OfferBuilding,
  OfferUnit,
  OfferAlternative,
} from '../offer-documents.repo';

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────

function fmt(n: number | null): string {
  if (n === null) return '';
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(n);
}

function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start);
  let count = 0;
  while (count < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return result;
}

function formatDateTR(d: Date): string {
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function activeUnits(units: OfferUnit[]): OfferUnit[] {
  return units.filter(u => !u.isMergedInto);
}

function totalM2(units: OfferUnit[]): number {
  return activeUnits(units).reduce((s, u) => s + u.brutM2, 0);
}

function buildingPercentages(b: OfferBuilding): { mila: number; tapu: number } {
  let milaM2 = 0, tapuM2 = 0;
  const allUnits = [
    ...(b.groundFloor.exists ? b.groundFloor.units : []),
    ...b.normalFloors.flatMap(f => f.units),
    ...(b.roofFloor.exists ? b.roofFloor.units : []),
    ...b.basementFloors.flatMap(f => f.units),
  ];
  for (const u of activeUnits(allUnits)) {
    if (u.ownerType === 'mila') milaM2 += u.brutM2;
    else if (u.ownerType === 'tapu') tapuM2 += u.brutM2;
  }
  const total = milaM2 + tapuM2;
  if (!total) return { mila: 0, tapu: 100 };
  const mila = Math.round((milaM2 / total) * 100);
  return { mila, tapu: 100 - mila };
}

/** Visual width %: halves the gap from 100% so narrower floors look close but not equal */
function visualPct(raw: number): number {
  return +(100 - (100 - raw) * 0.5).toFixed(1);
}

function floorWidths(b: OfferBuilding): { groundPct: number; basementPct: number } {
  const normalM2 = totalM2(b.normalFloors[0]?.units ?? []);
  const groundM2 = b.groundFloor.exists ? totalM2(b.groundFloor.units) : normalM2;
  const bsm = b.basementFloors[0];
  const basementM2 = bsm
    ? bsm.isCommonArea
      ? (bsm.commonAreaM2 ?? normalM2)
      : totalM2(bsm.units)
    : normalM2;
  const maxM2 = Math.max(normalM2, groundM2, basementM2) || 1;
  return {
    groundPct:   visualPct((groundM2   / maxM2) * 100),
    basementPct: visualPct((basementM2 / maxM2) * 100),
  };
}

// ─────────────────────────────────────────────
// SVG CRANE
// ─────────────────────────────────────────────

function craneSvg(size = 28, col = '#2196f3'): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 60 60" fill="none">
    <rect x="27" y="4" width="4" height="40" fill="${col}"/>
    <rect x="10" y="4" width="22" height="4" fill="${col}"/>
    <rect x="31" y="4" width="18" height="3" fill="${col}" opacity=".75"/>
    <line x1="31" y1="5" x2="49" y2="10" stroke="${col}" stroke-width="1.5"/>
    <line x1="31" y1="7" x2="49" y2="19" stroke="${col}" stroke-width="1"/>
    <rect x="46" y="10" width="5" height="10" fill="${col}" opacity=".85"/>
    <rect x="10" y="8" width="4" height="10" fill="${col}" opacity=".85"/>
    <rect x="25" y="44" width="10" height="5" fill="${col}" rx="1"/>
    <circle cx="27" cy="52" r="3" fill="${col}"/>
    <circle cx="35" cy="52" r="3" fill="${col}"/>
  </svg>`;
}

// ─────────────────────────────────────────────
// KROKIS CELLS
// ─────────────────────────────────────────────

function cellOwn(u: OfferUnit, numMap: Map<string, number>, extraStyle = ''): string {
  return `<div class="kr-cell own" style="${extraStyle}">
    <div class="kct">${u.ownerName || 'TAPU SAHİBİ'}</div>
    <div class="kca">Brüt: ${u.brutM2.toFixed(2)} m²</div>
    ${u.paymentAmount != null ? `<div class="kcp">₺${fmt(u.paymentAmount)}</div>` : ''}
    <div class="kb">${numMap.get(u.id) ?? ''}</div>
  </div>`;
}

function cellMil(u: OfferUnit, numMap: Map<string, number>): string {
  return `<div class="kr-cell mil">
    <div class="kct">MİLA İNŞAAT DEKORASYON PROJE SAN. TİC. LTD. ŞTİ.</div>
    <div class="kca">Brüt: ${u.brutM2.toFixed(2)} m²</div>
    <div class="kb">${numMap.get(u.id) ?? ''}</div>
  </div>`;
}

function renderCells(units: OfferUnit[], numMap: Map<string, number>): string {
  return activeUnits(units)
    .map(u => u.ownerType === 'mila' ? cellMil(u, numMap) : cellOwn(u, numMap))
    .join('');
}

/** Cells in a proportional (centered) row — first/last cell carry the outer border */
function renderCellsPartial(units: OfferUnit[], numMap: Map<string, number>): string {
  const au = activeUnits(units);
  return au.map((u, i) => {
    const bl = i === 0 ? 'border-left:1px solid #1a3060' : '';
    const br = i === au.length - 1 ? 'border-right:1px solid #1a3060' : '';
    const s  = [bl, br].filter(Boolean).join(';');
    return u.ownerType === 'mila' ? cellMil(u, numMap) : cellOwn(u, numMap, s);
  }).join('');
}

function floorLbl(name: string, area?: string): string {
  return `<div class="kr-lbl">
    <div class="kr-ln">${name}</div>
    ${area ? `<div class="kr-la">${area} m²</div>` : ''}
  </div>`;
}

// ─────────────────────────────────────────────
// KROKIS PAGE BODY
// ─────────────────────────────────────────────

function buildUnitNumberMap(building: OfferBuilding): Map<string, number> {
  const map = new Map<string, number>();
  let n = 1;

  // Ground floor first (zemin kat = 1, 2, 3...)
  if (building.groundFloor.exists)
    for (const u of activeUnits(building.groundFloor.units))
      map.set(u.id, u.unitNumber ?? n++);

  // Normal floors ascending (1. kat -> top floor)
  const sorted = [...building.normalFloors].sort((a, b) => a.floorNumber - b.floorNumber);
  for (const floor of sorted)
    for (const u of activeUnits(floor.units))
      map.set(u.id, u.unitNumber ?? n++);

  // Basement: only if not common area.
  for (const bsm of building.basementFloors) {
    if (bsm.isCommonArea) continue;
    for (const u of activeUnits(bsm.units))
      map.set(u.id, u.unitNumber ?? n++);
  }

  return map;
}

function krokisBody(building: OfferBuilding, altLabel: string): string {
  const numMap = buildUnitNumberMap(building);
  const { groundPct, basementPct } = floorWidths(building);
  const { mila, tapu } = buildingPercentages(building);

  const sorted = [...building.normalFloors].sort((a, b) => b.floorNumber - a.floorNumber);

  const normalRows = sorted.map((f, i) => {
    const m2 = totalM2(f.units);
    const bt = i === 0 ? 'border-top:1px solid #b0bec5;' : '';
    return `<div style="display:flex;height:52px;overflow:hidden;border-bottom:1px solid #b0bec5;${bt}">
      <div style="flex:1;display:flex">
        <div style="display:flex;width:100%;border-left:1px solid #1a3060;border-right:1px solid #1a3060">
          ${renderCells(f.units, numMap)}
        </div>
      </div>
      ${floorLbl(`${f.floorNumber}. KAT`, m2.toFixed(2))}
    </div>`;
  }).join('');

  let groundRow = '';
  if (building.groundFloor.exists && building.groundFloor.units.length) {
    groundRow = `<div style="display:flex;height:52px;overflow:hidden;border-bottom:1px solid #b0bec5">
      <div style="flex:1;display:flex;justify-content:center">
        <div style="display:flex;width:${groundPct}%">${renderCellsPartial(building.groundFloor.units, numMap)}</div>
      </div>
      ${floorLbl('ZEMİN KAT')}
    </div>`;
  }

  const basementRows = building.basementFloors.map(bsm => {
    if (bsm.isCommonArea) {
      return `<div style="display:flex;height:52px;overflow:hidden;border-bottom:1px solid #b0bec5">
        <div style="flex:1;display:flex;justify-content:center">
          <div class="kr-cell own" style="width:${basementPct}%;flex:none;display:flex;flex-direction:column;
            justify-content:center;align-items:center;text-align:center;
            border-left:1px solid #1a3060;border-right:1px solid #1a3060">
            <div style="font-size:9.5px;font-weight:700;color:#0d1f3c">
              ${(bsm.commonAreaM2 ?? 0).toFixed(2)} m²
            </div>
            <div style="font-size:7px;color:#5a6377;margin-top:2px;text-transform:uppercase;letter-spacing:.5px">
              ${bsm.commonAreaLabel ?? 'Ortak Alan'}
            </div>
          </div>
        </div>
        ${floorLbl(bsm.label)}
      </div>`;
    }
    return `<div style="display:flex;height:52px;overflow:hidden;border-bottom:1px solid #b0bec5">
      <div style="flex:1;display:flex;justify-content:center">
        <div style="display:flex;width:${basementPct}%">${renderCellsPartial(bsm.units, numMap)}</div>
      </div>
      ${floorLbl(bsm.label)}
    </div>`;
  }).join('');

  return `<div style="padding:0 10px 0"><div style="width:88%;margin:0 auto">
    <div style="display:flex;margin-bottom:0;align-items:flex-end">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 30" preserveAspectRatio="none"
        style="flex:1;height:30px;display:block">
        <polygon points="0,30 50,0 100,30" fill="#0d1f3c"/>
      </svg>
      <div style="width:60px;flex-shrink:0"></div>
    </div>
    ${normalRows}
    ${groundRow}
    ${basementRows}
    <div class="kr-legend">
      <div class="kr-li"><div class="kr-dot" style="background:#0d1f3c"></div>MİLA İNŞAAT <strong>%${mila}</strong></div>
      <div class="kr-sep"></div>
      <div class="kr-li"><div class="kr-dot" style="background:white;border:1px solid #1a3060"></div>MAL SAHİBİ <strong>%${tapu}</strong></div>
    </div>
  </div></div>`;
}

// ─────────────────────────────────────────────
// PAGE BUILDERS
// ─────────────────────────────────────────────

function pageHeader(subtitle = ''): string {
  return `<div class="ph">
    <div class="ph-l">${craneSvg(28, '#2196f3')}<div>
      <div class="ph-nm">MİLA İNŞAAT DEKORASYON PROJE SANAYİ VE TİCARET LİMİTED ŞİRKETİ</div>
      ${subtitle ? `<div class="ph-sb">${subtitle}</div>` : ''}
    </div></div>
    <div class="ph-r">www.milainsaat.com<br/>+90 216 390 73 00</div>
  </div>`;
}

function pageFooter(): string {
  return `<div class="pf">
    <div class="pf-l">MİLA İNŞAAT DEKORASYON PROJE SANAYİ VE TİCARET LİMİTED ŞİRKETİ</div>
    <div class="pf-r">www.milainsaat.com | info@milainsaat.com | +90 216 390 73 00</div>
  </div>`;
}

// PAGE 1 — COVER
function coverPage(doc: OfferDocument, offerDateStr: string): string {
  return `<div class="page" style="background:var(--nv);overflow:hidden;position:relative">

    <!-- White triangle: bottom-left to top-right diagonal -->
    <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:white;
      clip-path:polygon(100% 20%, 100% 100%, 0% 100%, 0% 80%)">
    </div>

    <!-- Watermark -->
    <div class="cv-wm">1983</div>

    <!-- Brand - sits in navy area (top-left) -->
    <div class="cv-brand">
      <div class="cv-row">${craneSvg(50, '#1878d8')}</div>
      <div class="cv-big">MİLA İNŞAAT</div>
      <div class="cv-ns">DEKORASYON · PROJE · SAN. TİC. LTD. ŞTİ.</div>
      <div class="cv-rule"></div>
      <div class="cv-web">www.milainsaat.com | Maltepe Ritim İstanbul Plaza | 1983'ten beri</div>
    </div>

    <!-- Project card - centered on the page -->
    <div style="position:absolute;top:50%;left:28px;right:28px;
      transform:translateY(-50%);
      background:white;border:1px solid var(--bd);
      border-radius:6px;padding:20px 24px;z-index:10">
      <div class="cv-cl">Kentsel Dönüşüm · Anahtar Teslimi · Götürü Bedel</div>
      <div class="cv-ct">${doc.parcelTitle}</div>
      <div class="cv-cs">İNŞAAT YAPIM TEKLİFİ</div>
      <div class="cv-mr">
        <div class="cv-mc">
          <div class="cv-ml">Teklif Tarihi</div>
          <div class="cv-mv">${offerDateStr}</div>
        </div>
        <div class="cv-mc">
          <div class="cv-ml">Firma</div>
          <div class="cv-mv" style="font-size:9px">${doc.companyName}</div>
        </div>
      </div>
    </div>

    <!-- Footer only - no header -->
    <div class="cv-ftr" style="z-index:999">
      <div class="cv-fl">MİLA İNŞAAT DEKORASYON PROJE SAN. TİC. LTD. ŞTİ. · Maltepe Ritim İstanbul Plaza</div>
      <div class="cv-fr">+90 216 390 73 00 · info@milainsaat.com</div>
    </div>
  </div>`;
}

// PAGE 2 — COMPANY (page2Content from rich text editor)
function aboutPage(doc: OfferDocument): string {
  return `<div class="page">
    ${pageHeader('inşaat · mimarlık · dekorasyon · danışmanlık · proje')}
    <div class="ab-hero">
      <div class="ab-hl">
        <div class="ab-ey">Kurumsal Profil · 1983'ten Beri</div>
        <div class="ab-hd">Firmamız<br/>Hakkında</div>
        <div class="ab-qt">"Biz, inşa etmiş olduğumuz binalarla mekâna ve çevreye değer üretiyoruz."</div>
        <div class="ab-mis">
          <p>Mila İnşaat, 1983 yılında faaliyetlerine başlayarak <strong style="color:rgba(255,255,255,.9)">44 yılı aşkın tecrübesiyle</strong> yurt içi ve yurt dışında inşaatları yapmış ve yapmaya devam etmektedir.</p>
          <p>Faaliyet gösterdiğimiz ilk günden bu yana <strong style="color:rgba(255,255,255,.9)">ilkeli yaklaşım, dürüstlük, yenilikçilik ve istikrar</strong> ilkeleriyle hareket ederek ülkemize değer üretiyoruz.</p>
        </div>
      </div>
      <div class="ab-hr">
        <div><div class="ab-sv">44+</div><div class="ab-sl">Yıl Tecrübe</div></div>
        <div class="ab-hd2"></div>
        <div><div class="ab-sv">100+</div><div class="ab-sl">Tamamlanan Proje</div></div>
        <div class="ab-hd2"></div>
        <div><div class="ab-sv">6</div><div class="ab-sl">Faaliyet Alanı</div></div>
      </div>
    </div>
    <div class="ab-body">
      <div class="stitle">Hakkımızda</div>
      <div class="ab-txt">${doc.page2Content}</div>
      <div class="stitle" style="margin-top:16px">Faaliyet Alanları</div>
      <div class="svc-row3">
        <div class="svc"><div class="svc-n">Müteahhitlik &amp; İnşaat</div><div class="svc-d">Konut, ofis, ticari ve sanayi yapıları ile altyapı ve peyzaj projeleri. Anahtar teslimi yapım garantisi.</div></div>
        <div class="svc"><div class="svc-n">Mimarlık &amp; Proje</div><div class="svc-d">Mimari, statik, mekanik, elektrik, geoteknik, peyzaj ve akustik proje tasarımı.</div></div>
        <div class="svc"><div class="svc-n">İç Mimari &amp; Dekorasyon</div><div class="svc-d">İç mekan tasarımı, malzeme seçimi ve eksiksiz uygulama hizmetleri.</div></div>
      </div>
      <div class="svc-row2c">
        <div class="svc"><div class="svc-n">Dış Cephe Kaplamasi</div><div class="svc-d">Teknolojik, uzun ömürlü ve estetik değer katan cephe kaplama sistemleri.</div></div>
        <div class="svc"><div class="svc-n">Danışmanlık</div><div class="svc-d">Tasarım, yapım ve yönetim konularında kurumsal ve bireysel danışmanlık.</div></div>
      </div>
    </div>
    ${pageFooter()}
  </div>`;
}

// PAGE 3 — TERMS (page2Content used as body)
function termsPage(doc: OfferDocument, offerDateStr: string, validityDate: string): string {
  return `<div class="page-flow">
    ${pageHeader()}
    <div class="pb">
      <div><div class="pbt">${doc.parcelTitle}</div><div class="pbs">İstanbul</div></div>
      <div class="pbb">TEKLİF KOŞULLARI</div>
    </div>

    <div class="page-flow-body">
      <div class="ab-txt">${doc.page2Content}</div>

      <div class="tm-br" style="page-break-inside:avoid;margin-top:20px">
        <div class="exb">
          <div class="exl">TCMB Efektif Döviz Satış Kuru</div>
          <div class="exv"><strong>${doc.tcmbRate}</strong></div>
        </div>
        <div class="sgb">
          <div class="sgn">İhsan Safa OSMANLIOĞLU</div>
          <div class="sgt">İnşaat Yüksek Mühendisi · İnşaat Proje Sorumlusu</div>
        </div>
        <div class="vlb">
          <div class="vll">Geçerlilik Tarihi</div>
          <div class="vld">${validityDate}</div>
          <div style="font-size:6.5px;color:rgba(255,255,255,.5);margin-top:2px">10 iş günü</div>
        </div>
      </div>
    </div>

  </div>`;
}

// PAGE 4+ — ONE KROKIS PAGE PER ALTERNATIVE
function alternativePage(doc: OfferDocument, alt: OfferAlternative, index: number, totalAltCount = doc.alternatives.length): string {
  const { mila, tapu } = buildingPercentages(alt.building);
  const totalAlts = totalAltCount > 1 ? totalAltCount : 0;
  const altSuffix = totalAlts > 1 ? ` · ${alt.label}` : '';
  return `<div class="page" style="page-break-before:always;page-break-after:always">
    ${pageHeader(`KAT MALİKLERİ PAYLAŞIM KROKİSİ · ${alt.label.toUpperCase()}`)}
    <div class="pb">
      <div>
        <div class="pbt">${doc.parcelTitle}</div>
        <div class="pbs">Bağımsız Bölüm Dağılım Krokisi</div>
      </div>
      <div class="pbb">%${mila} MÜT. / %${tapu} MAL SAH.</div>
    </div>

    <div style="position:absolute;top:110px;bottom:36px;left:0;right:0;
      display:flex;flex-direction:column;justify-content:flex-start;align-items:stretch">
      <div style="padding:12px 28px 8px;text-align:center">
        <div style="font-size:10px;font-weight:700;color:var(--nv);
          letter-spacing:.9px;text-transform:uppercase">
          BAĞIMSIZ BÖLÜM PAYLAŞIM PLANI${altSuffix}
        </div>
      </div>
      <div style="flex:0 0 auto">
        ${krokisBody(alt.building, alt.label)}
      </div>
    </div>

  </div>`;
}

// ─────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Poppins',sans-serif}
  @page{size:A4 portrait;margin:0}
  .page{width:210mm;height:297mm;position:relative;overflow:hidden;page-break-after:always;background:white}
  .page-flow{width:210mm;background:white;page-break-after:auto}
  .page-flow-body{padding:16px 28px 0;margin-bottom:36px}
  :root{--nv:#0a1e3d;--nv2:#0f2952;--bl:#0d5eb5;--bl2:#1878d8;--sky:#cde0f5;--sky2:#ecf5fd;--tx:#111827;--gr:#4b5a6d;--bd:#aacbe6}

  /* Header */
  .ph{height:50px;background:var(--nv);display:flex;align-items:center;padding:0 26px;justify-content:space-between}
  .ph-l{display:flex;align-items:center;gap:9px}
  .ph-nm{color:white;font-size:9.5px;font-weight:700}
  .ph-sb{color:rgba(255,255,255,.45);font-size:6.5px;margin-top:2px}
  .ph-r{color:rgba(255,255,255,.4);font-size:7px;text-align:right;line-height:1.7}
  /* Footer */
  .pf{position:absolute;bottom:0;left:0;right:0;height:36px;background:var(--nv);display:flex;align-items:center;justify-content:space-between;padding:0 26px}
  .pf-l{color:rgba(255,255,255,.55);font-size:6.5px}
  .pf-r{color:rgba(255,255,255,.3);font-size:6px}
  /* Project band */
  .pb{background:var(--bl);padding:9px 26px;display:flex;align-items:center;justify-content:space-between}
  .pbt{font-size:11px;font-weight:700;color:white}
  .pbs{font-size:7px;color:rgba(255,255,255,.65);margin-top:2px}
  .pbb{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);padding:3px 9px;border-radius:3px;font-size:7.5px;font-weight:700;color:white}
  /* Section title */
  .stitle{font-size:9.5px;font-weight:700;color:var(--nv);letter-spacing:.9px;text-transform:uppercase;border-bottom:2px solid var(--bl2);padding-bottom:4px;margin-bottom:9px;display:flex;align-items:center;gap:6px}
  .stitle::before{content:'';width:3px;height:13px;background:var(--bl2);display:inline-block;border-radius:2px}
  /* Cover */
  .cv-top{height:148mm;background:var(--nv);position:relative}
  .cv-wm{position:absolute;top:10px;right:20px;font-size:130px;font-weight:700;color:rgba(255,255,255,.04);letter-spacing:-4px;line-height:1}
  .cv-brand{position:absolute;top:32px;left:32px}
  .cv-row{display:flex;align-items:center;gap:12px;margin-bottom:10px}
  .cv-big{font-size:44px;font-weight:700;color:white;letter-spacing:-1.5px;line-height:1}
  .cv-ns{color:var(--sky);font-size:9px;letter-spacing:1.4px;margin-top:4px}
  .cv-rule{width:55px;height:3px;background:var(--bl2);margin:12px 0}
  .cv-web{color:rgba(255,255,255,.32);font-size:7.5px}
  .cv-card{margin:0 28px;background:white;border:1px solid var(--bd);border-radius:6px;padding:20px 24px;position:relative;top:-26px}
  .cv-cl{font-size:7px;font-weight:700;color:var(--bl);letter-spacing:2px;text-transform:uppercase;margin-bottom:7px}
  .cv-ct{font-size:26px;font-weight:700;color:var(--nv);line-height:1.05;margin-bottom:3px}
  .cv-cs{font-size:11px;font-weight:700;color:var(--bl);margin-bottom:3px}
  .cv-ca{font-size:8.5px;color:var(--gr);margin-bottom:16px}
  .cv-mr{display:flex;border:1px solid var(--bd);border-radius:4px;overflow:hidden}
  .cv-mc{flex:1;padding:9px 12px;border-right:1px solid var(--bd)}.cv-mc:last-child{border-right:none}
  .cv-ml{font-size:6.5px;font-weight:700;color:var(--gr);letter-spacing:.8px;text-transform:uppercase}
  .cv-mv{font-size:11.5px;font-weight:700;color:var(--nv);margin-top:2px}
  .cv-ftr{position:absolute;bottom:0;left:0;right:0;height:36px;background:var(--nv2);display:flex;align-items:center;justify-content:space-between;padding:0 26px}
  .cv-fl{color:rgba(255,255,255,.5);font-size:7px}
  .cv-fr{color:rgba(255,255,255,.28);font-size:6.5px}
  /* About */
  .ab-hero{background:var(--nv);display:flex;padding:30px 30px 32px}
  .ab-hl{flex:1;padding-right:22px}
  .ab-ey{font-size:8px;font-weight:700;color:var(--sky);letter-spacing:2px;text-transform:uppercase;margin-bottom:10px}
  .ab-hd{font-size:36px;font-weight:700;color:white;line-height:1.1;margin-bottom:14px}
  .ab-qt{font-size:10.5px;color:rgba(255,255,255,.65);font-style:italic;line-height:1.7;border-left:3px solid var(--bl2);padding-left:12px;margin-bottom:16px}
  .ab-mis{font-size:9.5px;color:rgba(255,255,255,.6);line-height:1.75}
  .ab-mis p{margin-bottom:8px}
  .ab-hr{background:rgba(255,255,255,.07);border-radius:4px;padding:22px 18px;width:155px;flex-shrink:0;display:flex;flex-direction:column;gap:0;border:1px solid rgba(255,255,255,.12)}
  .ab-sv{font-size:40px;font-weight:700;color:white;line-height:1}
  .ab-sl{font-size:7px;color:rgba(255,255,255,.5);letter-spacing:1px;text-transform:uppercase;margin-top:3px}
  .ab-hd2{height:1px;background:rgba(255,255,255,.12);margin:14px 0}
  .ab-body{padding:20px 30px 52px}
  .ab-txt{font-size:9px;color:#374151;line-height:1.5;margin-bottom:10px}
  .ab-txt p{margin-bottom:5px}
  .ab-txt ul, .ab-txt ol{padding-left:16px;margin-bottom:4px}
  .ab-txt ul ul, .ab-txt ol ol, .ab-txt ul ol, .ab-txt ol ul{padding-left:14px;margin-top:2px;margin-bottom:2px}
  .ab-txt li{margin-bottom:2px}
  .ab-txt li li{margin-bottom:1px}
  .svc-row3{display:flex;gap:10px;margin-bottom:10px}
  .svc-row3 .svc{flex:1}
  .svc-row2c{display:flex;gap:10px;justify-content:center}
  .svc-row2c .svc{flex:0 0 calc(33.333% - 6.667px)}
  .svc{border:1px solid var(--bd);border-radius:4px;padding:12px 14px;background:var(--sky2)}
  .svc-n{font-size:9px;font-weight:700;color:var(--nv);text-transform:uppercase;letter-spacing:.4px}
  .svc-d{font-size:8.5px;color:var(--gr);margin-top:4px;line-height:1.5}
  /* Terms */
  .tm-body{padding:16px 28px 52px}
  .tmtit{font-size:12.5px;font-weight:700;color:var(--nv);text-align:center;padding:9px 0;border-bottom:2px solid var(--nv);margin-bottom:13px;text-transform:uppercase;letter-spacing:.4px;line-height:1.4}
  .tms{margin-bottom:10px}
  .tmh{display:flex;align-items:center;gap:8px;background:var(--nv);padding:5px 10px;border-radius:3px;margin-bottom:5px}
  .tmn{font-size:10px;font-weight:700;color:var(--sky)}
  .tmnm{font-size:8.5px;font-weight:700;color:white;text-transform:uppercase;letter-spacing:.3px}
  .tmb{font-size:8.5px;color:#374151;padding:0 10px;line-height:1.55}
  .tmb strong{font-weight:700;color:var(--nv)}
  .tmul{list-style:none;padding:0;margin:4px 0 0}
  .tmul li{font-size:8px;color:#374151;padding:2.5px 0 2.5px 13px;position:relative;line-height:1.5;border-bottom:1px solid var(--sky2)}
  .tmul li::before{content:'▸';position:absolute;left:2px;color:var(--bl2);font-size:7px;top:3.5px}
  .tmul li strong{font-weight:700;color:var(--nv)}
  .tm-br{display:flex;gap:10px;margin-top:12px}
  .exb{flex:1;border:1px solid var(--bd);border-radius:3px;padding:9px 11px;background:var(--sky2);text-align:center;display:flex;flex-direction:column;justify-content:center;align-items:center}
  .exl{font-size:6.5px;font-weight:700;color:var(--gr);letter-spacing:.8px;text-transform:uppercase;text-decoration:underline}
  .exv{font-size:9.5px;color:#374151;margin-top:3px}
  .sgb{flex:1.2;border:1px solid var(--bd);border-radius:3px;padding:9px 11px;background:var(--sky2);text-align:center;display:flex;flex-direction:column;justify-content:center}
  .sgn{font-size:10.5px;font-weight:700;color:var(--nv)}
  .sgt{font-size:7px;color:var(--gr);margin-top:3px}
  .vlb{flex:.9;background:var(--bl);border-radius:3px;padding:9px 11px;text-align:center;display:flex;flex-direction:column;justify-content:center}
  .vll{font-size:6.5px;font-weight:700;color:rgba(255,255,255,.6);letter-spacing:.8px;text-transform:uppercase}
  .vld{font-size:13px;font-weight:700;color:white;margin-top:3px}
  /* Krokis */
  .kr-cell{flex:1;border-right:1px solid #1a3060;padding:6px 8px 18px;position:relative;min-height:36px}
  .kr-cell:last-child{border-right:none}
  .kr-cell.own{background:white}
  .kr-cell.mil{background:#0d1f3c}
  .kct{font-size:7px;font-weight:700;line-height:1.3;margin-bottom:2px}
  .kr-cell.own .kct{color:#0d1f3c}
  .kr-cell.mil .kct{color:white}
  .kca{font-size:6.5px;line-height:1.3}
  .kr-cell.own .kca{color:#374151}
  .kr-cell.mil .kca{color:rgba(255,255,255,.7)}
  .kcp{font-size:6.5px;color:#374151}
  .kb{position:absolute;bottom:3px;right:3px;background:#0d1f3c;color:white;font-size:7px;font-weight:700;width:15px;height:15px;display:flex;align-items:center;justify-content:center;border-radius:2px}
  .kr-cell.mil .kb{background:rgba(255,255,255,.2)}
  .kr-lbl{width:60px;flex-shrink:0;display:flex;flex-direction:column;justify-content:center;padding:4px 0 4px 7px}
  .kr-ln{font-size:7.5px;font-weight:700;color:#0d1f3c}
  .kr-la{font-size:6.5px;color:#5a6377;margin-top:1px}
  .kr-legend{display:flex;gap:12px;padding:5px 0 3px;border-top:1px solid var(--bd);margin-top:4px;align-items:center;justify-content:center}
  .kr-li{display:flex;align-items:center;gap:4px;font-size:7px;font-weight:700;color:#0d1f3c}
  .kr-dot{width:10px;height:10px;border-radius:2px;flex-shrink:0}
  .kr-sep{width:1px;height:14px;background:var(--bd)}
`;

// ─────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────

export function buildOfferHtml(doc: OfferDocument): string {
  const today = new Date();
  const offerDateStr = formatDateTR(today);
  const validityDate = formatDateTR(addBusinessDays(today, 10));

  const alts: OfferAlternative[] = doc.alternatives.length > 0
    ? doc.alternatives
    : [{ id: '1', label: 'Alternatif 1', building: doc.building }];

  const pages = [
    coverPage(doc, offerDateStr),
    termsPage(doc, offerDateStr, validityDate),
    ...alts.map((alt, i) => alternativePage(doc, alt, i, alts.length)),
  ];

  const lastIndex = pages.length - 1;
  pages[lastIndex] = pages[lastIndex].replace(
    'page-break-after:always',
    'page-break-after:auto',
  );

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <style>${CSS}</style>
</head>
<body>
  ${pages.join('\n')}
  <!-- Global fixed footer - appears on every page -->
  <div style="position:fixed;bottom:0;left:0;right:0;height:36px;background:var(--nv);
    display:flex;align-items:center;justify-content:space-between;padding:0 26px;z-index:10">
    <div class="pf-l">MİLA İNŞAAT DEKORASYON PROJE SANAYİ VE TİCARET LİMİTED ŞİRKETİ</div>
    <div class="pf-r">www.milainsaat.com | info@milainsaat.com | +90 216 390 73 00</div>
  </div>
</body>
</html>`;
}
