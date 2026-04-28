export const TENDER_STATUS_CONFIG: Record<string, {
  label: string;
  bg: string;
  color: string;
}> = {
  draft:   { label: 'Taslak', bg: '#F1F5F9', color: '#475569' },
  open:    { label: 'Açık',   bg: '#DBEAFE', color: '#1D4ED8' },
  closed:  { label: 'Kapalı', bg: '#FEF3C7', color: '#B45309' },
  awarded: { label: 'Verildi', bg: '#DCFCE7', color: '#16A34A' },
};

export const getTenderStatusConfig = (status: string) =>
  TENDER_STATUS_CONFIG[status] ?? { label: status, bg: '#F1F5F9', color: '#475569' };
