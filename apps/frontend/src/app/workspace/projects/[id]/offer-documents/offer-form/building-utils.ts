import type {
  OfferBuilding,
  OfferUnit,
  StreetLabels,
  UnitType,
} from '@/services/offer-documents/types';

export function computeGlobalNumbers(building: OfferBuilding): Map<number, number> {
  const map = new Map<number, number>();

  // Above-ground: zemin → normal floors (ascending) → çatı, counter starts at 1
  let n = 1;
  const aboveGround: OfferUnit[] = [
    ...(building.groundFloor.exists ? building.groundFloor.units : []),
    ...building.normalFloors.flatMap((f) => f.units),
    ...(building.roofFloor.exists ? building.roofFloor.units : []),
  ];
  for (const u of aboveGround) {
    if (!u.isMergedInto) map.set(u.id, n++);
  }

  // Basements: deepest (last index) → surface (index 0), separate counter from 1
  let b = 1;
  for (const floor of [...building.basementFloors].reverse()) {
    if (!floor.isCommonArea) {
      for (const u of floor.units) {
        if (!u.isMergedInto) map.set(u.id, b++);
      }
    }
  }

  return map;
}

export function calculateUnitM2(tabanAlani: number, merdivenPayi: number, unitCount: number): number {
  if (unitCount <= 0) return 0;
  const netAlan = Math.max(0, tabanAlani - merdivenPayi);
  return Math.round((netAlan / unitCount + Number.EPSILON) * 100) / 100;
}

export const emptyStreetLabels: StreetLabels = {
  left: null,
  right: null,
  bottom: null,
};

const UNIT_TYPE_NAMES: Record<UnitType, string> = {
  daire: 'TAPU SAHİBİ',
  dukkan: 'TAPU SAHİBİ',
  depo: 'DEPO',
  siginak: 'SIĞINAK',
  ortak_alan: 'ORTAK ALAN',
  diger: '',
};

export function makeUnit(id: number, brutM2 = 0, unitNumber?: number, unitType: UnitType = 'daire'): OfferUnit {
  const isNullOwner = unitType === 'siginak' || unitType === 'ortak_alan';
  return {
    id,
    ownerType: isNullOwner ? null : 'tapu',
    ownerName: UNIT_TYPE_NAMES[unitType],
    unitType,
    brutM2,
    paymentAmount: null,
    label: null,
    unitNumber: unitNumber ?? null,
    linkedUnitId: null,
    linkedUnitLabel: null,
    manualM2Override: false,
    mergedWithIds: [],
    isMergedInto: null,
  };
}

export function defaultBuilding(tabanAlani = 0): OfferBuilding {
  const brutM2 = calculateUnitM2(tabanAlani, 17.5, 2);
  return {
    staircaseDeduction: 17.5,
    basementFloors: [
      {
        label: '1. BODRUM KAT',
        isCommonArea: true,
        commonAreaM2: tabanAlani || null,
        commonAreaLabel: 'ORTAK ALAN',
        units: [makeUnit(1, brutM2, undefined, 'depo'), makeUnit(2, brutM2, undefined, 'depo')],
        streetLabels: emptyStreetLabels,
      },
    ],
    groundFloor: {
      exists: true,
      units: [makeUnit(1, brutM2), makeUnit(2, brutM2)],
      streetLabels: emptyStreetLabels,
    },
    normalFloors: [
      {
        floorNumber: 1,
        units: [makeUnit(1, brutM2), makeUnit(2, brutM2)],
      },
    ],
    roofFloor: {
      exists: false,
      units: [makeUnit(1, brutM2), makeUnit(2, brutM2)],
    },
  };
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

export const DEFAULT_PAGE2_HTML = `<p><strong>1.İnşaat yapımını çok kısa zamanda gerçekleşmesi ve kat maliklerinin kısa sürede yeni binaya taşınabilmeleri için aşağıda belirtilen 2 maddede karşılıklı olarak mutabık olunmalıdır;</strong></p><ul><li>Tüm kat maliklerinin yeniden yapıma mutabakat vermesi</li><li>Kat malikleri kendi paylarına düşen bedelleri ödemesi</li></ul><p><strong>2.Teklife dahil olan işler;</strong></p><ul><li>Riskli bina tespit raporu ve karot alım giderleri,</li><li>Bina yıkım ruhsatı ile yıkım bedeli giderleri,</li><li>Zemin etüdü giderleri,</li><li>Noter masrafları,</li><li>Harita ve aplikasyon masrafları (aplikasyon krokisi, çap, imar durumu belgesi, kot-kesit belgesi, ağaç revizyonu, Tip 1, Tip 2 ve Tip 3 vs. işlemleri),</li><li>Proje bedelleri (mimari, statik, mekanik, elektrik, geoteknik, peyzaj ve akustik projeler),</li><li>Onaylı projede yer alan tüm imalat ve uygulama bedelleri,</li><li>Mevzuat gereği yapılması zorunlu olan bodrum kat/katların imalat bedeli,</li><li>Sığınak imalat bedeli,</li><li>Zemin etüd raporu, alındığında zeminle ilgili zemin ıslahı, fore kazık, istinat duvarı yada iksa gibi ilave işlemler</li><li>İnşaat ruhsatı harç bedelleri,</li><li>İskân ruhsatı, vergi, resim ve harç giderleri,</li><li>Yapı denetim hizmet bedelleri,</li><li>Otopark yapım ve katılım bedelleri % 25'i,</li><li>Mobilizasyon, finansman kaybı ve diğer müteferrik giderler,</li><li>SGK primleri, KDV ve diğer yasal vergi yükümlülükleri,</li><li>ALL-RISK sigorta giderleri.</li></ul><p><strong>3.Diğer kurallar;</strong></p><ul><li>Ruhsat alındığından itibaren inşaat teslim süresi 12 aydır.</li><li>Brüt İnşaat Alanı:<ul><li>İmar planındaki şartlara göre brüt inşaat alanı 2.270,99 m² dir.</li><li>Buna 450 m² bodrum kat eklendiğinde toplam inşaat alanı 2720,99 m² olacaktır.</li></ul></li><li>Yeni hazırlanacak projede;<ul><li>Mevcut binaya göre her kata 2 daire ilave edilmiştir.</li><li>Bütün kat maliklerinden eşit oranda paylar müteahhit firmaya ayrılmış, bu paylara karşılık gelen daire bedelleri kat malikleri ödemesinden düşülmüştür.</li><li>Yeni proje mevcut binada bütün kat malikleri bulundukları kat ve konumlarını muhafaza edecek şekilde hazırlanmıştır.</li></ul></li><li>Teklifimiz sabit bedelli anahtar teslimi inşaat yapımını kapsamakta olup tapu ve imar durumundaki verilere göre hazırlanmıştır.</li><li>Tablodaki daire brüt (Alanları) yaklaşık olarak hesaplanmıştır.</li><li>İnşaat, en son (2018 yılı) Türkiye Bina Deprem Yönetmeliğine göre inşa edilecektir.</li><li>Teklifimiz 05.06.2026 tarihine kadar geçerlidir.</li></ul>`;
