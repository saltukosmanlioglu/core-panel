'use client';

import type { Dispatch, SetStateAction } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import SaveIcon from '@mui/icons-material/Save';
import type {
  Overhang,
  ParcelCalculation,
  Point,
  Setbacks,
  TKGMParcelResult,
} from '@/services/parcel-calculations/types';
import { ParcelVisualization } from '../components/ParcelVisualization';
import type {
  EdgeRole,
  NumericInputValue,
} from '../types';
import { formatArea, numberFormatter } from '../utils';

function computeFloorAreaBreakdown(
  footprintArea: number,
  footprintVertices: Point[],
  overhangs: Overhang[],
): Array<{ floorNumber: number; tabanAlani: number; cikmaEtkisi: number; netAlan: number }> | null {
  const hasOverhangs = overhangs.some(
    (o) => o.front > 0 || o.back > 0 || o.left > 0 || o.right > 0,
  );
  if (!hasOverhangs || footprintVertices.length < 3) return null;

  const CM = 100;
  const SQ = 10000;
  const box = {
    minX: Math.min(...footprintVertices.map((p) => p.x)),
    maxX: Math.max(...footprintVertices.map((p) => p.x)),
    minY: Math.min(...footprintVertices.map((p) => p.y)),
    maxY: Math.max(...footprintVertices.map((p) => p.y)),
  };

  return overhangs.map((o) => {
    if (o.floor === 1) {
      return { floorNumber: 1, tabanAlani: footprintArea, cikmaEtkisi: 0, netAlan: footprintArea };
    }
    const expMinX = box.minX - o.left * CM;
    const expMaxX = box.maxX + o.right * CM;
    const expMinY = box.minY - o.back * CM;
    const expMaxY = box.maxY + o.front * CM;
    const expanded = Math.max(0, expMaxX - expMinX) * Math.max(0, expMaxY - expMinY) / SQ;
    const extra = Math.max(0, Math.round((expanded - footprintArea) * 100) / 100);
    return {
      floorNumber: o.floor,
      tabanAlani: footprintArea,
      cikmaEtkisi: extra,
      netAlan: Math.round((footprintArea + extra) * 100) / 100,
    };
  });
}

interface PerFloorOverhangPolygon {
  floor: number;
  label: string;
  vertices: Point[];
}

interface ResultProps {
  blockNumber: string;
  parcelNumber: string;
  parcelResult: TKGMParcelResult | null;
  parcelArea: number;
  selectedFootprintArea: number;
  selectedFloorCount: number;
  totalConstructionArea: number;
  calculationResult: ParcelCalculation | null;
  calculationError: string | null;
  parcelVertices: Point[];
  visualizationFootprintVertices: Point[] | undefined;
  visualOverhangVertices: Point[] | undefined;
  perFloorOverhangVertices?: PerFloorOverhangPolygon[];
  setbacks: Setbacks;
  maxOverhangs: Setbacks;
  edgeRoles: EdgeRole[];
  edgeSetbacks: NumericInputValue[];
  edgeOverhangs: NumericInputValue[];
  edgeOverhangActive: boolean[];
  rotationDegrees: number;
  setRotationDegrees: Dispatch<SetStateAction<number>>;
  isSaving: boolean;
  isCalculatingResult: boolean;
  onBack: () => void;
  onSave: () => void;
}

export function Result({
  blockNumber,
  parcelNumber,
  parcelResult,
  parcelArea,
  selectedFootprintArea,
  selectedFloorCount,
  totalConstructionArea,
  calculationResult,
  calculationError,
  parcelVertices,
  visualizationFootprintVertices,
  visualOverhangVertices,
  perFloorOverhangVertices,
  setbacks,
  maxOverhangs,
  edgeRoles,
  edgeSetbacks,
  edgeOverhangs,
  edgeOverhangActive,
  rotationDegrees,
  setRotationDegrees,
  isSaving,
  isCalculatingResult,
  onBack,
  onSave,
}: ResultProps) {
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Chip size="small" label={`Parsel: ${blockNumber || parcelResult?.info.blockNo || '-'}/${parcelNumber || parcelResult?.info.parcelNo || '-'}`} />
        <Chip size="small" label={`Alan: ${formatArea(calculationResult?.parcelArea ?? parcelArea)}`} />
        <Chip size="small" label={`Taban: ${formatArea(calculationResult?.footprintArea ?? selectedFootprintArea)}`} />
        <Chip size="small" label={`Kat: ${selectedFloorCount}`} />
        <Chip size="small" label={`İnşaat: ${formatArea(calculationResult?.totalConstructionArea ?? totalConstructionArea)}`} />
      </Stack>

      {calculationError ? <Alert severity="error" sx={{ fontSize: 12, py: 0.5 }}>{calculationError}</Alert> : null}

      {calculationResult && (() => {
        const breakdown = computeFloorAreaBreakdown(
          calculationResult.footprintArea,
          calculationResult.footprintVertices,
          calculationResult.overhangs,
        );
        const totalExtra = breakdown
          ? breakdown.filter((r) => r.floorNumber > 1).reduce((sum, r) => sum + r.cikmaEtkisi, 0)
          : 0;
        if (totalExtra <= 0) return null;
        return (
          <Typography sx={{ fontSize: 12, color: 'text.secondary', fontStyle: 'italic' }}>
            Üst katlarda çıkma ile ek alan: {numberFormatter.format(totalExtra)} m²
          </Typography>
        );
      })()}

      <Card
        variant="outlined"
        sx={{
          borderRadius: 1,
          borderColor: '#e2e8f0',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'stretch', sm: 'center' },
              justifyContent: 'space-between',
              gap: 2,
              mb: 2,
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Sonuç Görünümü
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}>
              <Tooltip title="-15° döndür">
                <IconButton onClick={() => setRotationDegrees((current) => current - 15)} size="small">
                  <RotateLeftIcon />
                </IconButton>
              </Tooltip>
              <Typography sx={{ minWidth: 48, textAlign: 'center', fontWeight: 600, fontSize: 12 }}>
                {rotationDegrees}°
              </Typography>
              <Tooltip title="+15° döndür">
                <IconButton onClick={() => setRotationDegrees((current) => current + 15)} size="small">
                  <RotateRightIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Sıfırla">
                <IconButton onClick={() => setRotationDegrees(0)} size="small">
                  <RestartAltIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>

          <Box sx={{ width: '100%', overflowX: 'auto' }}>
            <ParcelVisualization
              parcelVertices={calculationResult?.parcelVertices ?? parcelVertices}
              footprintVertices={visualizationFootprintVertices}
              overhangVertices={visualOverhangVertices}
              perFloorOverhangVertices={perFloorOverhangVertices}
              width={860}
              height={560}
              showLabels
              rotationDeg={rotationDegrees}
              setbacks={setbacks}
              maxOverhangs={maxOverhangs}
              edgeRoles={edgeRoles}
              edgeSetbacks={edgeSetbacks.map((value) => parseFloat(String(value)) || 0)}
              edgeOverhangs={edgeOverhangs.map((value, index) => (
                (edgeOverhangActive[index] ?? true) ? (parseFloat(String(value)) || 0) : 0
              ))}
              showSetbackAnnotations
              showOverhangAnnotations
            />
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Button size="small" variant="outlined" onClick={onBack}>
          ← Geri
        </Button>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'stretch', sm: 'flex-end' }, gap: 0.5 }}>
          <Button
            size="small"
            variant="contained"
            startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon fontSize="small" />}
            onClick={onSave}
            disabled={isSaving || !calculationResult || isCalculatingResult}
            sx={{ borderRadius: 1, px: 4 }}
          >
            {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', textAlign: { xs: 'left', sm: 'right' } }}>
            Bu proje için en fazla 3 hesaplama kaydedilebilir. Eski kayıtlar otomatik silinir.
          </Typography>
        </Box>
      </Box>
    </Stack>
  );
}
