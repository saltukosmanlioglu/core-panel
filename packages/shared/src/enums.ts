export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  COMPANY_ADMIN = 'company_admin',
}

export enum TenderItemUnit {
  PIECE = 'adet',
  SQUARE_METER = 'm2',
  CUBIC_METER = 'm3',
  LINEAR_METER = 'm',
  KILOGRAM = 'kg',
  TON = 'ton',
  HOUR = 'saat',
  DAY = 'gün',
  MONTH = 'ay',
  LUMP_SUM = 'götürü',
}

export const TenderItemUnitLabels: Record<string, string> = {
  adet: 'Adet',
  m2: 'M²',
  m3: 'M³',
  m: 'Metre',
  kg: 'Kilogram',
  ton: 'Ton',
  saat: 'Saat',
  gün: 'Gün',
  ay: 'Ay',
  götürü: 'Götürü',
};
