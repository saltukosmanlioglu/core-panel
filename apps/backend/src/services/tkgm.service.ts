import { AppError } from '../lib/AppError';

const TKGM_CBS_BASE = 'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api/idariYapi';
const TKGM_PARSEL_BASE = 'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3/api/parsel';

const TKGM_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  Accept: 'application/json',
};

interface AdministrativeItem {
  id: number;
  name: string;
}

interface TKGMRawFeature {
  type: string;
  geometry: { type: string; coordinates: any };
  properties: { id: number; text: string };
}

interface TKGMRawListResponse {
  features: TKGMRawFeature[];
}

interface TKGMRawParcelResponse {
  Message?: string;
  type?: string;
  geometry?: {
    type: string;
    coordinates: number[][][];
  };
  properties?: {
    ilAd: string;
    ilceAd: string;
    mahalleAd: string;
    adaNo: string;
    parselNo: string;
    alan: string;
    nitelik: string;
    pafta: string;
    zeminKmdurum: string;
    ozet: string;
    ilId: number;
    ilceId: number;
    mahalleId: number;
    mevkii: string;
    durum: string;
  };
}

interface ParcelVertex {
  x: number;
  y: number;
}

interface ParcelEdge {
  label: string;
  length: number;
  angle: number;
}

interface ParcelCoordinate {
  lat: number;
  lng: number;
}

interface ParcelInfo {
  provinceName: string;
  districtName: string;
  neighborhoodName: string;
  blockNo: string;
  parcelNo: string;
  landType: string;
  mapSheet: string;
  landStatus: string;
  summary: string;
}

interface ParcelResult {
  coordinates: ParcelCoordinate[];
  area: number;
  info: ParcelInfo;
  edges: ParcelEdge[];
  vertices: ParcelVertex[];
}

const PROVINCES: AdministrativeItem[] = [
  { id: 1, name: 'Adana' },
  { id: 2, name: 'Adıyaman' },
  { id: 3, name: 'Afyonkarahisar' },
  { id: 4, name: 'Ağrı' },
  { id: 5, name: 'Amasya' },
  { id: 6, name: 'Ankara' },
  { id: 7, name: 'Antalya' },
  { id: 8, name: 'Artvin' },
  { id: 9, name: 'Aydın' },
  { id: 10, name: 'Balıkesir' },
  { id: 11, name: 'Bilecik' },
  { id: 12, name: 'Bingöl' },
  { id: 13, name: 'Bitlis' },
  { id: 14, name: 'Bolu' },
  { id: 15, name: 'Burdur' },
  { id: 16, name: 'Bursa' },
  { id: 17, name: 'Çanakkale' },
  { id: 18, name: 'Çankırı' },
  { id: 19, name: 'Çorum' },
  { id: 20, name: 'Denizli' },
  { id: 21, name: 'Diyarbakır' },
  { id: 22, name: 'Edirne' },
  { id: 23, name: 'Elazığ' },
  { id: 24, name: 'Erzincan' },
  { id: 25, name: 'Erzurum' },
  { id: 26, name: 'Eskişehir' },
  { id: 27, name: 'Gaziantep' },
  { id: 28, name: 'Giresun' },
  { id: 29, name: 'Gümüşhane' },
  { id: 30, name: 'Hakkari' },
  { id: 31, name: 'Hatay' },
  { id: 32, name: 'Isparta' },
  { id: 33, name: 'Mersin' },
  { id: 34, name: 'İstanbul' },
  { id: 35, name: 'İzmir' },
  { id: 36, name: 'Kars' },
  { id: 37, name: 'Kastamonu' },
  { id: 38, name: 'Kayseri' },
  { id: 39, name: 'Kırklareli' },
  { id: 40, name: 'Kırşehir' },
  { id: 41, name: 'Kocaeli' },
  { id: 42, name: 'Konya' },
  { id: 43, name: 'Kütahya' },
  { id: 44, name: 'Malatya' },
  { id: 45, name: 'Manisa' },
  { id: 46, name: 'Kahramanmaraş' },
  { id: 47, name: 'Mardin' },
  { id: 48, name: 'Muğla' },
  { id: 49, name: 'Muş' },
  { id: 50, name: 'Nevşehir' },
  { id: 51, name: 'Niğde' },
  { id: 52, name: 'Ordu' },
  { id: 53, name: 'Rize' },
  { id: 54, name: 'Sakarya' },
  { id: 55, name: 'Samsun' },
  { id: 56, name: 'Siirt' },
  { id: 57, name: 'Sinop' },
  { id: 58, name: 'Sivas' },
  { id: 59, name: 'Tekirdağ' },
  { id: 60, name: 'Tokat' },
  { id: 61, name: 'Trabzon' },
  { id: 62, name: 'Tunceli' },
  { id: 63, name: 'Şanlıurfa' },
  { id: 64, name: 'Uşak' },
  { id: 65, name: 'Van' },
  { id: 66, name: 'Yozgat' },
  { id: 67, name: 'Zonguldak' },
  { id: 68, name: 'Aksaray' },
  { id: 69, name: 'Bayburt' },
  { id: 70, name: 'Karaman' },
  { id: 71, name: 'Kırıkkale' },
  { id: 72, name: 'Batman' },
  { id: 73, name: 'Şırnak' },
  { id: 74, name: 'Bartın' },
  { id: 75, name: 'Ardahan' },
  { id: 76, name: 'Iğdır' },
  { id: 77, name: 'Yalova' },
  { id: 78, name: 'Karabük' },
  { id: 79, name: 'Kilis' },
  { id: 80, name: 'Osmaniye' },
  { id: 81, name: 'Düzce' },
];

const ADMIN_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const administrativeCache = new Map<string, { expiresAt: number; data: AdministrativeItem[] }>();

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR');
}

function sortByName(items: AdministrativeItem[]): AdministrativeItem[] {
  return [...items].sort((first, second) => first.name.localeCompare(second.name, 'tr'));
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: TKGM_HEADERS });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const message = body.replace(/^"|"$/g, '').trim();

    if (response.status === 403 && message.includes('Günlük sorgu limitini aştınız')) {
      throw new AppError('TKGM günlük sorgu limiti aşıldı. Lütfen daha sonra tekrar deneyin.', 429, 'TKGM_DAILY_LIMIT_EXCEEDED');
    }

    throw new AppError(message || 'TKGM sorgusu başarısız oldu', 502, 'TKGM_REQUEST_FAILED');
  }

  return response.json() as Promise<T>;
}

async function cachedAdministrativeList(key: string, url: string): Promise<AdministrativeItem[]> {
  const cached = administrativeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const raw = await fetchJson<TKGMRawListResponse>(url);
  const data = mapAdministrativeResponse(raw);
  administrativeCache.set(key, { data, expiresAt: Date.now() + ADMIN_CACHE_TTL_MS });
  return data;
}

function mapAdministrativeResponse(raw: TKGMRawListResponse): AdministrativeItem[] {
  return sortByName(
    (raw.features ?? []).map((feature) => ({
      id: feature.properties.id,
      name: feature.properties.text,
    })),
  );
}

async function getProvinceList(): Promise<AdministrativeItem[]> {
  return sortByName(PROVINCES);
}

async function getTkgmProvinceId(plateCode: number): Promise<number> {
  const province = PROVINCES.find((item) => item.id === plateCode);

  if (!province) {
    throw new AppError('Geçersiz il kodu', 400, 'INVALID_PROVINCE_ID');
  }

  const tkgmProvinces = await cachedAdministrativeList('provinces:tkgm', `${TKGM_CBS_BASE}/ilListe`);
  const matchedProvince = tkgmProvinces.find((item) => normalizeName(item.name) === normalizeName(province.name));

  if (!matchedProvince) {
    throw new AppError('TKGM il eşleşmesi bulunamadı', 502, 'TKGM_PROVINCE_MAPPING_FAILED');
  }

  return matchedProvince.id;
}

async function getDistrictList(provinceId: number): Promise<AdministrativeItem[]> {
  const tkgmProvinceId = await getTkgmProvinceId(provinceId);
  return cachedAdministrativeList(
    `districts:plate:${provinceId}:tkgm:${tkgmProvinceId}`,
    `${TKGM_CBS_BASE}/ilceListe/${tkgmProvinceId}`,
  );
}

async function getNeighborhoodList(districtId: number): Promise<AdministrativeItem[]> {
  return cachedAdministrativeList(`neighborhoods:${districtId}`, `${TKGM_CBS_BASE}/mahalleListe/${districtId}`);
}

async function fetchParcel(
  neighborhoodId: number,
  blockNo: string,
  parcelNo: string,
): Promise<ParcelResult> {
  const raw = await fetchJson<TKGMRawParcelResponse>(
    `${TKGM_PARSEL_BASE}/${neighborhoodId}/${encodeURIComponent(blockNo)}/${encodeURIComponent(parcelNo)}`,
  );

  if (raw.Message || !raw.geometry) {
    throw new Error('Parsel bulunamadı');
  }

  const rawPoints: ParcelCoordinate[] = raw.geometry.coordinates[0].map((coordinate) => ({
    lng: coordinate[0],
    lat: coordinate[1],
  }));

  if (rawPoints.length < 3) {
    throw new Error('Parsel geometrisi geçersiz');
  }

  const firstPoint = rawPoints[0]!;
  const lastPoint = rawPoints[rawPoints.length - 1]!;
  const points = firstPoint.lat === lastPoint.lat && firstPoint.lng === lastPoint.lng
    ? rawPoints.slice(0, -1)
    : rawPoints;

  const origin = points[0]!;
  const earthRadius = 6371000;
  const toRadians = (degrees: number) => degrees * Math.PI / 180;

  const vertices: ParcelVertex[] = points.map((point) => ({
    x: Math.round(toRadians(point.lng - origin.lng) * earthRadius * Math.cos(toRadians(origin.lat)) * 100 * 100) / 100,
    y: Math.round(toRadians(point.lat - origin.lat) * earthRadius * 100 * 100) / 100,
  }));

  const edgeLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const edges: ParcelEdge[] = [];

  for (let i = 0; i < vertices.length; i++) {
    const current = vertices[i]!;
    const next = vertices[(i + 1) % vertices.length]!;
    const previous = vertices[(i - 1 + vertices.length) % vertices.length]!;

    const dx = next.x - current.x;
    const dy = next.y - current.y;
    const length = Math.round(Math.sqrt(dx * dx + dy * dy) * 100) / 100;

    const v1x = previous.x - current.x;
    const v1y = previous.y - current.y;
    const v2x = next.x - current.x;
    const v2y = next.y - current.y;

    const dot = v1x * v2x + v1y * v2y;
    const cross = v1x * v2y - v1y * v2x;
    let angle = Math.atan2(Math.abs(cross), dot) * 180 / Math.PI;
    if (cross < 0) angle = 360 - angle;
    angle = Math.round(angle * 10) / 10;

    edges.push({
      label: i < 26 ? edgeLabels[i]! : `P${i + 1}`,
      length,
      angle,
    });
  }

  const area = Number.parseFloat((raw.properties?.alan ?? '0').replace(/\./g, '').replace(',', '.'));

  return {
    coordinates: points,
    area: Number.isFinite(area) ? area : 0,
    info: {
      provinceName: raw.properties?.ilAd ?? '',
      districtName: raw.properties?.ilceAd ?? '',
      neighborhoodName: raw.properties?.mahalleAd ?? '',
      blockNo: raw.properties?.adaNo ?? blockNo,
      parcelNo: raw.properties?.parselNo ?? parcelNo,
      landType: raw.properties?.nitelik ?? '',
      mapSheet: raw.properties?.pafta ?? '',
      landStatus: raw.properties?.zeminKmdurum ?? '',
      summary: raw.properties?.ozet ?? '',
    },
    edges,
    vertices,
  };
}

export { getProvinceList, getDistrictList, getNeighborhoodList, fetchParcel };
export type {
  AdministrativeItem,
  ParcelResult,
  ParcelEdge,
  ParcelVertex,
  ParcelCoordinate,
  ParcelInfo,
};
