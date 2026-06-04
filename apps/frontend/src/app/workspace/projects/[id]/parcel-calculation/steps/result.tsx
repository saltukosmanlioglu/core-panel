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
import { formatArea } from '../utils';

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
      </Box>
    </Stack>
  );
}
