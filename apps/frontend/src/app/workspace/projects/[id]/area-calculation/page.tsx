'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Article as ArticleIcon,
  Calculate as CalculateIcon,
  Close as CloseIcon,
  DeleteOutline as DeleteOutlineIcon,
  Folder as FolderIcon,
  Map as MapIcon,
  Note as NoteIcon,
  WarningAmber as WarningAmberIcon,
} from '@mui/icons-material';
import type { AreaCalculation, CalculatedResults, DedicationInfo } from '@core-panel/shared';
import { Notification } from '@/components';
import { useSnackbar } from '@/hooks/useSnackbar';
import {
  analyzeAreaCalculationApi,
  deleteAreaCalculationApi,
  getAreaCalculationsApi,
} from '@/services/area-calculations/api';
import { getErrorMessage } from '@/utils/getErrorMessage';
import ParcelVisualization from '@/components/ParcelVisualization';

type UploadKey = 'rolovesi' | 'eimar' | 'planNotes' | 'otherFiles';

interface UploadState {
  rolovesi: File | null;
  eimar: File | null;
  planNotes: File | null;
  otherFiles: File[];
}

const EMPTY_UPLOADS: UploadState = {
  rolovesi: null,
  eimar: null,
  planNotes: null,
  otherFiles: [],
};

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const STATUS_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: 'Bekliyor', bg: '#f1f5f9', color: '#64748b' },
  processing: { label: 'İşleniyor', bg: '#dbeafe', color: '#1d4ed8' },
  completed: { label: 'Tamamlandı', bg: '#dcfce7', color: '#15803d' },
  failed: { label: 'Hata', bg: '#fee2e2', color: '#b91c1c' },
};

const numberFormatter = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function isAllowedFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return ALLOWED_TYPES.includes(file.type) || /\.(pdf|png|jpe?g|webp|gif)$/.test(lowerName);
}

function formatNumber(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? numberFormatter.format(value) : '—';
}

function formatArea(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${numberFormatter.format(value)} m²` : '—';
}

function formatMeter(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${numberFormatter.format(value)} m` : '—';
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/\s/g, '').replace(/[^0-9,.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === ',' || cleaned === '.') return null;
  const commaIndex = cleaned.lastIndexOf(',');
  const dotIndex = cleaned.lastIndexOf('.');
  let normalized = cleaned;
  if (commaIndex >= 0 && dotIndex >= 0) {
    normalized = commaIndex > dotIndex ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '');
  } else if (commaIndex >= 0) {
    normalized = cleaned.replace(',', '.');
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatRawMeter(value: unknown): string {
  return formatMeter(coerceNumber(value));
}

function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString('tr-TR') : '—';
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return numberFormatter.format(value);
  if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';
  return String(value);
}

function readValue(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }
  return null;
}

function normalizeCoordinate(row: unknown, index: number): { nokta_no: number; Y: number; X: number } | null {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;

  const record = row as Record<string, unknown>;
  const y = coerceNumber(readValue(record, ['Y', 'y']));
  const x = coerceNumber(readValue(record, ['X', 'x']));
  const pointIndex = coerceNumber(readValue(record, ['nokta_no', 'pointIndex', 'point_no', 'no', 'id']));

  if (y === null || x === null) return null;

  return {
    nokta_no: pointIndex === null ? index + 1 : Math.round(pointIndex),
    Y: y,
    X: x,
  };
}

function createParcelVisualizationData(calculation: AreaCalculation | null) {
  const extracted = calculation?.extractedData;
  const results = calculation?.calculatedResults;

  if (!extracted || !results || !Array.isArray(extracted.coordinates) || extracted.coordinates.length < 3) {
    return null;
  }

  const coordinates = extracted.coordinates
    .map((coordinate, index) => normalizeCoordinate(coordinate, index))
    .filter((coordinate): coordinate is { nokta_no: number; Y: number; X: number } => coordinate !== null);

  if (coordinates.length < 3) {
    return null;
  }

  return {
    extractedData: {
      parcel: {
        ada: extracted.parcel.ada === null ? null : String(extracted.parcel.ada),
        parsel: extracted.parcel.parsel === null ? null : String(extracted.parcel.parsel),
        ilce: extracted.parcel.ilce,
        mahalle: extracted.parcel.mahalle,
        net_alan: results.net_alan ?? coerceNumber(extracted.parcel.net_alan),
        tapu_alani: results.tapu_alani ?? coerceNumber(extracted.parcel.tapu_alani),
      },
      coordinates,
      setbacks: {
        on_bahce: results.on_bahce,
        yan_bahce: results.yan_bahce,
        arka_bahce: results.arka_bahce,
        effective_west: coerceNumber(extracted.setbacks.effective_west),
      },
      front_facade: {
        edge_start_point: coerceNumber(extracted.front_facade.edge_start_point),
        edge_end_point: coerceNumber(extracted.front_facade.edge_end_point),
        description: extracted.front_facade.description,
      },
    },
    calculatedResults: {
      max_insaat_alani: results.max_insaat_alani,
      max_taban_oturumu_min: results.max_taban_oturumu_min,
      max_taban_oturumu_max: results.max_taban_oturumu_max,
      net_alan: results.net_alan,
      tapu_alani: results.tapu_alani,
      terk_alani: results.terk_alani,
      on_bahce: results.on_bahce,
      yan_bahce: results.yan_bahce,
      arka_bahce: results.arka_bahce,
    },
  };
}

function getStatusStyle(status: string): { label: string; bg: string; color: string } {
  return STATUS_STYLES[status] ?? STATUS_STYLES.pending;
}

function getNetAreaSourceBadge(source: string | null | undefined): React.ReactNode {
  if (source === 'röleve_coordinates') {
    return (
      <Chip
        size="small"
        label="Röleveden Hesaplandı"
        sx={{ backgroundColor: '#dcfce7', color: '#166534', fontWeight: 800, height: 22 }}
      />
    );
  }

  if (source === 'eimar_document') {
    return (
      <Chip
        size="small"
        label="E-İmar Belgesi"
        sx={{ backgroundColor: '#ffedd5', color: '#c2410c', fontWeight: 800, height: 22 }}
      />
    );
  }

  return null;
}

function getBuildableAreaSourceBadge(source: string | null | undefined): React.ReactNode {
  if (source === 'block_lines') {
    return (
      <Chip
        size="small"
        label="Blok Çizgilerinden"
        sx={{ backgroundColor: '#dcfce7', color: '#166534', fontWeight: 800, height: 22 }}
      />
    );
  }

  if (source === 'setbacks') {
    return (
      <Chip
        size="small"
        label="Bahçe Mesafelerinden"
        sx={{ backgroundColor: '#ffedd5', color: '#c2410c', fontWeight: 800, height: 22 }}
      />
    );
  }

  return null;
}

function InfoItem({
  label,
  value,
  fullWidth = false,
  badge = null,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <Box sx={{ gridColumn: fullWidth ? '1 / -1' : 'auto' }}>
      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25, flexWrap: 'wrap' }}>
        <Typography sx={{ color: '#0f172a', fontWeight: 700, wordBreak: 'break-word' }}>
          {value}
        </Typography>
        {badge}
      </Box>
    </Box>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card variant="outlined" sx={{ borderColor: '#e2e8f0', borderRadius: 1 }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 2 }}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}

function UploadZone({
  title,
  subtitle,
  icon,
  files,
  multiple = false,
  maxFiles = 1,
  error,
  onSelect,
  onRemove,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  files: File[];
  multiple?: boolean;
  maxFiles?: number;
  error?: string;
  onSelect: (files: File[]) => void;
  onRemove: (index: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selected = files.length > 0;

  const handleFiles = (incoming: File[]) => {
    onSelect(incoming.slice(0, maxFiles));
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <Card
      variant="outlined"
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      sx={{
        minHeight: 190,
        borderStyle: 'dashed',
        borderWidth: 2,
        borderColor: error ? '#dc2626' : selected ? '#2D6A4F' : '#cbd5e1',
        backgroundColor: selected ? '#f0fdf4' : '#ffffff',
        cursor: 'pointer',
        transition: 'border-color 0.2s ease, background-color 0.2s ease',
        '&:hover': { borderColor: error ? '#dc2626' : '#2D6A4F' },
      }}
    >
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <input
          ref={inputRef}
          hidden
          type="file"
          accept="application/pdf,image/*"
          multiple={multiple}
          onChange={(event) => {
            handleFiles(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
        <Box sx={{ color: selected ? '#2D6A4F' : '#64748b', display: 'flex', alignItems: 'center', gap: 1 }}>
          {icon}
          <Typography sx={{ fontWeight: 800, color: '#0f172a', lineHeight: 1.25 }}>{title}</Typography>
        </Box>
        <Typography variant="body2" sx={{ color: '#64748b' }}>{subtitle}</Typography>
        <Typography variant="caption" sx={{ color: '#94a3b8' }}>PDF, PNG, JPG, WEBP</Typography>

        <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {files.map((file, index) => (
            <Box
              key={`${file.name}-${index}`}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, color: '#166534' }}
              onClick={(event) => event.stopPropagation()}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.name}
              </Typography>
              <Tooltip title="Kaldır">
                <IconButton size="small" onClick={() => onRemove(index)} sx={{ color: '#166534', ml: 'auto' }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
          {error && <Typography variant="caption" sx={{ color: '#dc2626', fontWeight: 600 }}>{error}</Typography>}
        </Box>
      </CardContent>
    </Card>
  );
}

function HighlightBox({
  title,
  value,
  formula,
  tone,
}: {
  title: string;
  value: React.ReactNode;
  formula?: string;
  tone: 'green' | 'blue' | 'orange';
}) {
  const palette = {
    green: { bg: '#ecfdf5', border: '#bbf7d0', text: '#166534' },
    blue: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
    orange: { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
  }[tone];

  return (
    <Box sx={{ p: 2.5, border: `1px solid ${palette.border}`, backgroundColor: palette.bg, borderRadius: 1 }}>
      <Typography variant="body2" sx={{ color: palette.text, fontWeight: 800, mb: 1 }}>
        {title}
      </Typography>
      <Typography variant="h5" sx={{ color: '#0f172a', fontWeight: 900 }}>
        {value}
      </Typography>
      {formula && <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 1 }}>{formula}</Typography>}
    </Box>
  );
}

function SetbackDiagram({ results }: { results: CalculatedResults }) {
  return (
    <Box sx={{ width: '100%', maxWidth: 520, mx: 'auto', mb: 2 }}>
      <svg viewBox="0 0 520 320" role="img" aria-label="Bahçe mesafeleri diyagramı" style={{ width: '100%', height: 'auto' }}>
        <rect x="70" y="30" width="380" height="260" fill="#f8fafc" stroke="#94a3b8" strokeWidth="2" />
        <rect x="165" y="95" width="190" height="135" fill="#e0f2fe" stroke="#0284c7" strokeWidth="2" />
        <line x1="260" y1="30" x2="260" y2="95" stroke="#2D6A4F" strokeDasharray="6 5" strokeWidth="2" />
        <line x1="70" y1="160" x2="165" y2="160" stroke="#f97316" strokeDasharray="6 5" strokeWidth="2" />
        <line x1="355" y1="160" x2="450" y2="160" stroke="#f97316" strokeDasharray="6 5" strokeWidth="2" />
        <line x1="260" y1="230" x2="260" y2="290" stroke="#64748b" strokeDasharray="6 5" strokeWidth="2" />
        <text x="260" y="68" textAnchor="middle" fontSize="15" fontWeight="700" fill="#166534">
          Ön bahçe: {formatMeter(results.on_bahce)}
        </text>
        <text x="112" y="148" textAnchor="middle" fontSize="14" fontWeight="700" fill="#c2410c">
          Yan: {formatMeter(results.yan_bahce)}
        </text>
        <text x="408" y="148" textAnchor="middle" fontSize="14" fontWeight="700" fill="#c2410c">
          Yan: {formatMeter(results.yan_bahce)}
        </text>
        <text x="260" y="270" textAnchor="middle" fontSize="15" fontWeight="700" fill="#475569">
          Arka bahçe: {formatMeter(results.arka_bahce)}
        </text>
        <text x="260" y="168" textAnchor="middle" fontSize="16" fontWeight="800" fill="#0f172a">Yapı Oturumu</text>
      </svg>
    </Box>
  );
}

function ResultsSection({ calculation }: { calculation: AreaCalculation }) {
  const extracted = calculation.extractedData;
  const results = calculation.calculatedResults;

  if (!extracted || !results) {
    return (
      <Alert severity={calculation.status === 'failed' ? 'error' : 'info'}>
        Bu analizin sonuçları henüz hazır değil.
      </Alert>
    );
  }

  const coordinateRows = extracted.coordinates.map((row) => row as Record<string, unknown>);
  const dedicationRows = extracted.dedications.map((row) => row as DedicationInfo & Record<string, unknown>);
  const floorSetbacks = Array.isArray(results.floor_setbacks) ? results.floor_setbacks : [];
  const shouldShowFloorSetbacks = floorSetbacks.length > 0 && results.setback_increase_applies;
  const projectionDifference = typeof results.projection_bonus_area === 'number'
    ? results.projection_bonus_area
    : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <SectionCard title="Parsel Bilgileri">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2.5 }}>
          <InfoItem label="Ada/Parsel" value={results.ada_parsel ?? '—'} />
          <InfoItem label="İlçe/Mahalle" value={`${extracted.parcel.ilce ?? '—'} / ${extracted.parcel.mahalle ?? '—'}`} />
          <InfoItem label="Tapu Alanı" value={formatArea(results.tapu_alani)} />
          <InfoItem
            label="Net Alan"
            value={formatArea(results.net_alan)}
            badge={getNetAreaSourceBadge(results.net_area_source)}
          />
          <InfoItem label="Terk Alanı" value={formatArea(results.terk_alani)} />
          <InfoItem label="Fonksiyon" value={extracted.parcel.fonksiyon ?? '—'} />
          <InfoItem label="Plan Adı" value={extracted.parcel.plan_name ?? '—'} fullWidth />
        </Box>
      </SectionCard>

      <SectionCard title="İmar Parametreleri">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2.5 }}>
          <InfoItem label="KAKS (Emsal)" value={formatNumber(results.kaks)} />
          <InfoItem label="TAKS Min" value={formatNumber(results.taks_min)} />
          <InfoItem label="TAKS Max" value={formatNumber(results.taks_max)} />
          <InfoItem label="Kat Adedi" value={formatNumber(results.kat_adedi)} />
          <InfoItem label="Bina Yüksekliği" value={formatMeter(results.bina_yuksekligi)} />
          <InfoItem label="İnşaat Nizamı" value={results.insaat_nizami ?? '—'} />
          <InfoItem label="Kaynak" value={extracted.zoning.kaks_source ?? '—'} />
          <InfoItem label="Çıkmalar KAKS’a Dahil" value={displayValue(results.projection_included_in_kaks)} />
        </Box>
      </SectionCard>

      <SectionCard title="Hesaplanan Değerler">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.2fr 1.2fr 0.8fr' }, gap: 2 }}>
          <HighlightBox
            tone="green"
            title="Maksimum İnşaat Alanı"
            value={formatArea(results.max_insaat_alani)}
            formula={`KAKS (${formatNumber(results.kaks)}) × Net Alan (${formatArea(results.net_alan)})`}
          />
          <HighlightBox
            tone="blue"
            title="Maksimum Taban Oturumu"
            value={`Min: ${formatArea(results.max_taban_oturumu_min)} / Max: ${formatArea(results.max_taban_oturumu_max)}`}
            formula={`TAKS (${formatNumber(results.taks_min)}-${formatNumber(results.taks_max)}) × Net Alan`}
          />
          <HighlightBox tone="orange" title="Terk Alanı" value={formatArea(results.terk_alani)} />
        </Box>
      </SectionCard>

      <SectionCard title="Blok Çizgileri ve İnşaat Alanı">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2.5 }}>
          <InfoItem
            label="İnşaat Genişliği"
            value={formatMeter(results.buildable_width)}
            badge={getBuildableAreaSourceBadge(results.buildable_area_source)}
          />
          <InfoItem label="İnşaat Derinliği" value={formatMeter(results.buildable_depth)} />
          <InfoItem label="Hesaplanan Taban Alanı" value={formatArea(results.buildable_area_from_block_lines)} />
        </Box>
      </SectionCard>

      {shouldShowFloorSetbacks && (
        <SectionCard title="Kat Bazlı Bahçe Mesafeleri">
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Kat</TableCell>
                  <TableCell>Ön Bahçe</TableCell>
                  <TableCell>Yan Bahçe</TableCell>
                  <TableCell>Arka Bahçe</TableCell>
                  <TableCell>İnşaat Genişliği</TableCell>
                  <TableCell>İnşaat Derinliği</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {floorSetbacks.map((floorSetback) => (
                  <TableRow
                    key={floorSetback.floor}
                    sx={{
                      backgroundColor:
                        results.first_affected_floor !== null && floorSetback.floor > results.first_affected_floor
                          ? '#fff7ed'
                          : 'transparent',
                    }}
                  >
                    <TableCell>{floorSetback.floor}</TableCell>
                    <TableCell>{formatMeter(floorSetback.front_setback)}</TableCell>
                    <TableCell>{formatMeter(floorSetback.side_setback)}</TableCell>
                    <TableCell>{formatMeter(floorSetback.rear_setback)}</TableCell>
                    <TableCell>{formatMeter(floorSetback.buildable_width)}</TableCell>
                    <TableCell>{formatMeter(floorSetback.buildable_depth)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 1.5 }}>
            {results.first_affected_floor ?? '—'}. kattan sonra her kat için etkilenen bahçe mesafelerine +{formatRawMeter(results.setback_increase?.increase_per_floor_m)} eklenir.
          </Typography>
        </SectionCard>
      )}

      {results.projection_bonus_area != null && (
        <SectionCard title="Çıkma Etkisi">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 2 }}>
            <HighlightBox
              tone="orange"
              title="Çıkma Alanı"
              value={formatArea(results.projection_bonus_area)}
            />
            <HighlightBox
              tone="blue"
              title="KAKS ile Max Alan"
              value={formatArea(results.max_insaat_alani)}
            />
            <HighlightBox
              tone="green"
              title="Çıkma Dahil Max Alan"
              value={formatArea(results.adjusted_max_insaat_alani)}
              formula={`Fark: +${formatArea(projectionDifference)}`}
            />
          </Box>
          {results.projection_note && <Alert severity="info">{results.projection_note}</Alert>}
        </SectionCard>
      )}

      <SectionCard title="Bahçe Mesafeleri">
        <SetbackDiagram results={results} />
        {results.setback_increase?.applies && (
          <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2 }}>
            5. kattan sonra her kat için yan/arka bahçeye +{formatRawMeter(results.setback_increase.increase_per_floor_m)} eklenir
          </Alert>
        )}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Mesafe</TableCell>
                <TableCell>Değer</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow><TableCell>Ön Bahçe</TableCell><TableCell>{formatMeter(results.on_bahce)}</TableCell></TableRow>
              <TableRow><TableCell>Yan Bahçe</TableCell><TableCell>{formatMeter(results.yan_bahce)}</TableCell></TableRow>
              <TableRow><TableCell>Arka Bahçe</TableCell><TableCell>{formatMeter(results.arka_bahce)}</TableCell></TableRow>
              <TableRow><TableCell>Not</TableCell><TableCell>{extracted.setbacks.note ?? '—'}</TableCell></TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>

      <SectionCard title="Koordinatlar ve Terk Bilgileri">
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Koordinatlar</Typography>
        <TableContainer sx={{ mb: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nokta No</TableCell>
                <TableCell>Y (Doğu)</TableCell>
                <TableCell>X (Kuzey)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {coordinateRows.length === 0 ? (
                <TableRow><TableCell colSpan={3}>—</TableCell></TableRow>
              ) : coordinateRows.map((row, index) => (
                <TableRow key={index}>
                  <TableCell>{displayValue(readValue(row, ['nokta_no', 'point_no', 'no', 'id']))}</TableCell>
                  <TableCell>{displayValue(readValue(row, ['y', 'Y']))}</TableCell>
                  <TableCell>{displayValue(readValue(row, ['x', 'X']))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Terk Bilgileri</Typography>
        <TableContainer sx={{ mb: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Kenar</TableCell>
                <TableCell>Miktar (m)</TableCell>
                <TableCell>Tip</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dedicationRows.length === 0 ? (
                <TableRow><TableCell colSpan={3}>—</TableCell></TableRow>
              ) : dedicationRows.map((row, index) => (
                <TableRow key={index}>
                  <TableCell>{displayValue(readValue(row, ['edge', 'kenar']))}</TableCell>
                  <TableCell>{displayValue(readValue(row, ['amount_m', 'miktar_m', 'amount', 'miktar']))}</TableCell>
                  <TableCell>{displayValue(readValue(row, ['type', 'tip']))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <InfoItem label="Ön Çizgisi" value={formatRawMeter(results.block_lines.on_cizgisi_m)} />
          <InfoItem label="Arka Çizgisi" value={formatRawMeter(results.block_lines.arka_cizgisi_m)} />
        </Box>
      </SectionCard>

      <SectionCard title="Ön Cephe Bilgisi">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <InfoItem label="Yol Cepheli Kenar" value={`${displayValue(results.front_facade.edge_start_point)} - ${displayValue(results.front_facade.edge_end_point)}`} />
          <InfoItem label="Açıklama" value={results.front_facade.description ?? '—'} />
        </Box>
      </SectionCard>

      <SectionCard title="Katsayı">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: 2 }}>
          <InfoItem label="Katsayı" value={displayValue(results.coefficient.value)} />
          <InfoItem label="Not" value={results.coefficient.note ?? '—'} />
        </Box>
      </SectionCard>
    </Box>
  );
}

export default function AreaCalculationPage() {
  const { id } = useParams<{ id: string }>();
  const [calculations, setCalculations] = useState<AreaCalculation[]>([]);
  const [selected, setSelected] = useState<AreaCalculation | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploads, setUploads] = useState<UploadState>(EMPTY_UPLOADS);
  const [zoneErrors, setZoneErrors] = useState<Partial<Record<UploadKey, string>>>({});
  const [note, setNote] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { showSuccess, showError, notificationProps } = useSnackbar();

  const hasAnyFile = Boolean(uploads.rolovesi || uploads.eimar || uploads.planNotes || uploads.otherFiles.length > 0);
  const parcelVisualizationData = useMemo(() => createParcelVisualizationData(selected), [selected]);

  const loadCalculations = useCallback(async (selectId?: string) => {
    const items = await getAreaCalculationsApi(id);
    setCalculations(items);
    const nextSelected = selectId
      ? items.find((item) => item.id === selectId) ?? null
      : selected
        ? items.find((item) => item.id === selected.id) ?? selected
        : items[0] ?? null;
    setSelected(nextSelected);
    setShowUpload(items.length === 0);
  }, [id, selected]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        const items = await getAreaCalculationsApi(id);
        if (!active) return;
        setCalculations(items);
        setSelected(items[0] ?? null);
        setShowUpload(items.length === 0);
      } catch (error) {
        if (active) showError(getErrorMessage(error, 'Analizler yüklenemedi'));
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [id]);

  const resetUploads = () => {
    setUploads(EMPTY_UPLOADS);
    setZoneErrors({});
    setNote('');
  };

  const setFiles = (key: UploadKey, incoming: File[]) => {
    const invalid = incoming.find((file) => !isAllowedFile(file));
    if (invalid) {
      setZoneErrors((current) => ({ ...current, [key]: 'Sadece PDF veya görsel dosyası yükleyin' }));
      return;
    }

    setZoneErrors((current) => ({ ...current, [key]: undefined }));
    setUploads((current) => {
      if (key === 'otherFiles') {
        return { ...current, otherFiles: incoming.slice(0, 5) };
      }
      return { ...current, [key]: incoming[0] ?? null };
    });
  };

  const removeFile = (key: UploadKey, index: number) => {
    setUploads((current) => {
      if (key === 'otherFiles') {
        return { ...current, otherFiles: current.otherFiles.filter((_, i) => i !== index) };
      }
      return { ...current, [key]: null };
    });
    setZoneErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleAnalyze = async () => {
    if (!hasAnyFile) {
      showError('En az bir belge yükleyin');
      return;
    }

    try {
      setAnalyzing(true);
      const result = await analyzeAreaCalculationApi(id, {
        rolovesi: uploads.rolovesi,
        eimar: uploads.eimar,
        planNotes: uploads.planNotes,
        otherFiles: uploads.otherFiles,
        note: note.trim() || undefined,
      });
      await loadCalculations(result.id);
      resetUploads();
      setShowUpload(false);
      showSuccess('Analiz tamamlandı');
    } catch (error) {
      showError(getErrorMessage(error, 'Analiz tamamlanamadı'));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = async (calculation: AreaCalculation) => {
    try {
      setDeletingId(calculation.id);
      await deleteAreaCalculationApi(calculation.id);
      const nextItems = calculations.filter((item) => item.id !== calculation.id);
      setCalculations(nextItems);
      setSelected((current) => (current?.id === calculation.id ? nextItems[0] ?? null : current));
      setShowUpload(nextItems.length === 0);
      showSuccess('Analiz silindi');
    } catch (error) {
      showError(getErrorMessage(error, 'Analiz silinemedi'));
    } finally {
      setDeletingId(null);
    }
  };

  const warningMessages = useMemo(() => {
    const selectedWarnings = selected?.warnings ?? [];
    const extractedWarnings = selected?.extractedData?.warnings ?? [];
    return Array.from(new Set([...selectedWarnings, ...extractedWarnings]));
  }, [selected]);

  const uploadSection = (
    <Card variant="outlined" sx={{ borderColor: '#e2e8f0', borderRadius: 1 }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Yeni Analiz</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
          <UploadZone
            title="İnşaat İstikamet Rölovesi"
            subtitle="Koordinat ve terk bilgileri"
            icon={<MapIcon />}
            files={uploads.rolovesi ? [uploads.rolovesi] : []}
            error={zoneErrors.rolovesi}
            onSelect={(files) => setFiles('rolovesi', files)}
            onRemove={(index) => removeFile('rolovesi', index)}
          />
          <UploadZone
            title="E-İmar Belgesi"
            subtitle="İmar durumu belgesi"
            icon={<ArticleIcon />}
            files={uploads.eimar ? [uploads.eimar] : []}
            error={zoneErrors.eimar}
            onSelect={(files) => setFiles('eimar', files)}
            onRemove={(index) => removeFile('eimar', index)}
          />
          <UploadZone
            title="Plan Notları"
            subtitle="İmar planı notları"
            icon={<NoteIcon />}
            files={uploads.planNotes ? [uploads.planNotes] : []}
            error={zoneErrors.planNotes}
            onSelect={(files) => setFiles('planNotes', files)}
            onRemove={(index) => removeFile('planNotes', index)}
          />
          <UploadZone
            title="Diğer Belgeler"
            subtitle="İlgili diğer belgeler (max 5)"
            icon={<FolderIcon />}
            files={uploads.otherFiles}
            multiple
            maxFiles={5}
            error={zoneErrors.otherFiles}
            onSelect={(files) => setFiles('otherFiles', files)}
            onRemove={(index) => removeFile('otherFiles', index)}
          />
        </Box>

        <TextField
          label="Notlar (opsiyonel)"
          fullWidth
          multiline
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          sx={{ mt: 2.5 }}
        />

        <Button
          fullWidth
          variant="contained"
          disabled={!hasAnyFile || analyzing}
          onClick={() => void handleAnalyze()}
          sx={{
            mt: 2,
            height: 52,
            backgroundColor: '#2D6A4F',
            fontWeight: 800,
            '&:hover': { backgroundColor: '#235c43' },
          }}
        >
          {analyzing ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress color="inherit" size={20} />
              Belgeler analiz ediliyor...
            </Box>
          ) : 'Analiz Et'}
        </Button>
        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: '#64748b', mt: 1 }}>
          Bu işlem 30-60 saniye sürebilir
        </Typography>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Typography variant="h4" sx={{ fontWeight: 900, color: '#0f172a' }}>
          İnşaat Alanı Hesaplama
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowUpload(true)}
          sx={{ backgroundColor: '#2D6A4F', fontWeight: 800, '&:hover': { backgroundColor: '#235c43' } }}
        >
          Yeni Analiz
        </Button>
      </Box>

      {(showUpload || calculations.length === 0) && uploadSection}

      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Skeleton variant="rounded" height={220} />
          <Skeleton variant="rounded" height={180} />
        </Box>
      ) : (
        <>
          {selected && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <CalculateIcon sx={{ color: '#2D6A4F' }} />
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  Seçili Analiz
                </Typography>
                <Chip
                  size="small"
                  label={getStatusStyle(selected.status).label}
                  sx={{
                    backgroundColor: getStatusStyle(selected.status).bg,
                    color: getStatusStyle(selected.status).color,
                    fontWeight: 800,
                  }}
                />
                <Typography variant="body2" sx={{ color: '#64748b' }}>{formatDate(selected.createdAt)}</Typography>
              </Box>

              <ResultsSection calculation={selected} />

              {parcelVisualizationData && (
                <Card sx={{ mt: 3, overflow: 'hidden' }}>
                  <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="h6" fontWeight={600}>
                      Parsel Görselleştirme
                    </Typography>
                  </Box>
                  <ParcelVisualization
                    extractedData={parcelVisualizationData.extractedData}
                    calculatedResults={parcelVisualizationData.calculatedResults}
                  />
                </Card>
              )}

              {warningMessages.length > 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {warningMessages.map((warning, index) => (
                    <Alert key={`${warning}-${index}`} severity="warning">{warning}</Alert>
                  ))}
                </Box>
              )}
            </Box>
          )}

          <Card variant="outlined" sx={{ borderColor: '#e2e8f0', borderRadius: 1 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 900, mb: 2 }}>Önceki Analizler</Typography>
              {calculations.length === 0 ? (
                <Box sx={{ py: 5, textAlign: 'center', color: '#64748b' }}>
                  <CalculateIcon sx={{ fontSize: 44, opacity: 0.45, mb: 1 }} />
                  <Typography sx={{ fontWeight: 700 }}>Henüz analiz yok</Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  {calculations.map((calculation, index) => {
                    const style = getStatusStyle(calculation.status);
                    return (
                      <Box key={calculation.id}>
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr auto', md: '1.2fr 1fr 1fr auto auto' },
                            gap: 1.5,
                            alignItems: 'center',
                            py: 1.5,
                            cursor: 'pointer',
                            backgroundColor: selected?.id === calculation.id ? '#f8fafc' : 'transparent',
                            px: 1,
                            borderRadius: 1,
                          }}
                          onClick={() => setSelected(calculation)}
                        >
                          <Typography sx={{ fontWeight: 800 }}>{formatDate(calculation.createdAt)}</Typography>
                          <Typography sx={{ color: '#475569' }}>{calculation.calculatedResults?.ada_parsel ?? '—'}</Typography>
                          <Typography sx={{ color: '#0f172a', fontWeight: 700 }}>
                            {formatArea(calculation.calculatedResults?.max_insaat_alani ?? null)}
                          </Typography>
                          <Chip size="small" label={style.label} sx={{ backgroundColor: style.bg, color: style.color, fontWeight: 800, width: 'fit-content' }} />
                          <Tooltip title="Sil">
                            <span>
                              <IconButton
                                size="small"
                                disabled={deletingId === calculation.id}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleDelete(calculation);
                                }}
                              >
                                {deletingId === calculation.id ? <CircularProgress size={18} /> : <DeleteOutlineIcon fontSize="small" />}
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Box>
                        {index < calculations.length - 1 && <Divider />}
                      </Box>
                    );
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Notification {...notificationProps} />
    </Box>
  );
}
