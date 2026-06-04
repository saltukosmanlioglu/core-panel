'use client';

import type { Dispatch, SetStateAction } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import SearchIcon from '@mui/icons-material/Search';
import type {
  AdministrativeItem,
  Point,
  TKGMParcelResult,
} from '@/services/parcel-calculations/types';
import { ParcelVisualization } from '../components/ParcelVisualization';
import { queryFieldStyle } from '../utils';

interface ParcelQueryProps {
  provinces: AdministrativeItem[];
  districts: AdministrativeItem[];
  neighborhoods: AdministrativeItem[];
  selectedProvince: number | null;
  selectedDistrict: number | null;
  selectedNeighborhood: number | null;
  blockNumber: string;
  parcelNumber: string;
  isLoading: boolean;
  error: string | null;
  parcelResult: TKGMParcelResult | null;
  parcelVertices: Point[];
  canQuery: boolean;
  rotationDegrees: number;
  setRotationDegrees: Dispatch<SetStateAction<number>>;
  onProvinceChange: (value: string) => void;
  onDistrictChange: (value: string) => void;
  onNeighborhoodChange: (value: number | null) => void;
  onBlockNumberChange: (value: string) => void;
  onParcelNumberChange: (value: string) => void;
  onQuery: () => void;
  onNext: () => void;
}

export function ParcelQuery({
  provinces,
  districts,
  neighborhoods,
  selectedProvince,
  selectedDistrict,
  selectedNeighborhood,
  blockNumber,
  parcelNumber,
  isLoading,
  error,
  parcelResult,
  parcelVertices,
  canQuery,
  rotationDegrees,
  setRotationDegrees,
  onProvinceChange,
  onDistrictChange,
  onNeighborhoodChange,
  onBlockNumberChange,
  onParcelNumberChange,
  onQuery,
  onNext,
}: ParcelQueryProps) {
  return (
    <Stack spacing={3}>
      <Box
        sx={{
          bgcolor: 'grey.50',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          p: 3,
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary', mb: 2.5 }}>
          Parsel Sorgula
        </Typography>
        <Divider sx={{ mb: 2.5 }} />

        <Stack spacing={2}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: '1fr 1fr',
              },
              gap: 2,
              alignItems: 'start',
            }}
          >
            <FormControl fullWidth size="small" sx={queryFieldStyle}>
              <InputLabel id="province-label" size="small">İl</InputLabel>
              <Select
                size="small"
                labelId="province-label"
                label="İl"
                value={selectedProvince ? String(selectedProvince) : ''}
                onChange={(event) => onProvinceChange(String(event.target.value))}
              >
                {provinces.map((province) => (
                  <MenuItem key={province.id} value={String(province.id)}>
                    {province.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small" disabled={!selectedProvince} sx={queryFieldStyle}>
              <InputLabel id="district-label" size="small">İlçe</InputLabel>
              <Select
                size="small"
                labelId="district-label"
                label="İlçe"
                value={selectedDistrict ? String(selectedDistrict) : ''}
                onChange={(event) => onDistrictChange(String(event.target.value))}
              >
                {districts.map((district) => (
                  <MenuItem key={district.id} value={String(district.id)}>
                    {district.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: '1fr 1fr 1fr',
              },
              gap: 2,
              alignItems: 'start',
            }}
          >
            <FormControl fullWidth size="small" disabled={!selectedDistrict} sx={queryFieldStyle}>
              <InputLabel id="neighborhood-label" size="small">Mahalle</InputLabel>
              <Select
                size="small"
                labelId="neighborhood-label"
                label="Mahalle"
                value={selectedNeighborhood ? String(selectedNeighborhood) : ''}
                onChange={(event) => onNeighborhoodChange(event.target.value ? Number(event.target.value) : null)}
              >
                {neighborhoods.map((neighborhood) => (
                  <MenuItem key={neighborhood.id} value={String(neighborhood.id)}>
                    {neighborhood.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              size="small"
              label="Ada No"
              type="text"
              value={blockNumber}
              onChange={(event) => onBlockNumberChange(event.target.value)}
              fullWidth
              inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
              sx={queryFieldStyle}
            />

            <TextField
              size="small"
              label="Parsel No"
              type="text"
              value={parcelNumber}
              onChange={(event) => onParcelNumberChange(event.target.value)}
              fullWidth
              inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
              sx={queryFieldStyle}
            />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: { xs: 'stretch', md: 'flex-end' }, mt: 2 }}>
            <Button
              size="small"
              variant="contained"
              color="primary"
              startIcon={<SearchIcon />}
              endIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : null}
              onClick={onQuery}
              disabled={!canQuery || isLoading}
              sx={{
                borderRadius: '4px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                fontSize: '0.875rem',
              }}
            >
              Sorgula
            </Button>
          </Box>

          {error ? (
            <Alert severity="error" sx={{ mt: 2, fontSize: 12, py: 0.5 }}>
              {error}
            </Alert>
          ) : null}
        </Stack>
      </Box>

      {parcelResult ? (
        <>
          <Box sx={{ bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 1, px: 2, py: 1 }}>
            <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap" alignItems="center" sx={{ color: '#334155' }}>
              <Typography variant="body2">
                <Box component="span" sx={{ fontWeight: 600 }}>Ada:</Box>{' '}
                {parcelResult.info.blockNo || blockNumber || '-'}
              </Typography>
              <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#cbd5e1' }} />
              <Typography variant="body2">
                <Box component="span" sx={{ fontWeight: 600 }}>Parsel:</Box>{' '}
                {parcelResult.info.parcelNo || parcelNumber || '-'}
              </Typography>
              <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#cbd5e1' }} />
              <Typography variant="body2">
                <Box component="span" sx={{ fontWeight: 600 }}>Nitelik:</Box>{' '}
                {parcelResult.info.landType || '-'}
              </Typography>
            </Stack>
          </Box>

          <Card
            variant="outlined"
            sx={{
              borderRadius: 2,
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
                <Typography
                  variant="subtitle2"
                  sx={{ borderLeft: '3px solid', borderColor: 'primary.main', pl: 1.5, fontWeight: 600 }}
                >
                  Arsa Görünümü
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}>
                  <Tooltip title="-15° döndür">
                    <IconButton onClick={() => setRotationDegrees((current) => current - 15)} size="small">
                      <RotateLeftIcon />
                    </IconButton>
                  </Tooltip>
                  <Typography variant="body2" sx={{ minWidth: 48, textAlign: 'center', fontWeight: 600, fontSize: 12 }}>
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
                  parcelVertices={parcelVertices}
                  width={860}
                  height={560}
                  showLabels
                  rotationDeg={rotationDegrees}
                />
              </Box>
            </CardContent>
          </Card>

          <Box sx={{ display: 'flex', justifyContent: { xs: 'stretch', md: 'flex-end' } }}>
            <Button
              size="small"
              variant="contained"
              onClick={onNext}
              disabled={!parcelResult}
            >
              Devam Et →
            </Button>
          </Box>
        </>
      ) : null}
    </Stack>
  );
}
