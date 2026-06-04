'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  Chip,
  IconButton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import type {
  Edge,
  ParcelCalculation,
  Point,
  Setbacks,
} from '@/services/parcel-calculations/types';
import { ParcelVisualization } from '../components/ParcelVisualization';
import type {
  EdgeRole,
  FloorOption,
  FloorOptionIndex,
  NumericInputValue,
} from '../types';
import { edgeRoleOptions } from '../utils';

interface FacadeSetbacksProps {
  edges: Edge[];
  edgeRoles: EdgeRole[];
  edgeSetbacks: NumericInputValue[];
  setEdgeSetbacks: Dispatch<SetStateAction<NumericInputValue[]>>;
  edgeOverhangs: NumericInputValue[];
  setEdgeOverhangs: Dispatch<SetStateAction<NumericInputValue[]>>;
  edgeOverhangActive: boolean[];
  setEdgeOverhangActive: Dispatch<SetStateAction<boolean[]>>;
  parcelVertices: Point[];
  localFootprintVertices: Point[] | null;
  calculationResult: ParcelCalculation | null;
  visualOverhangVertices: Point[] | undefined;
  setbacks: Setbacks;
  maxOverhangs: Setbacks;
  rotationDegrees: number;
  setRotationDegrees: Dispatch<SetStateAction<number>>;
  floorOptions: FloorOption[];
  selectedFloorOption: FloorOptionIndex;
  setSelectedFloorOption: Dispatch<SetStateAction<FloorOptionIndex>>;
  calculationError: string | null;
  isCalculatingResult: boolean;
  onRoleChange: (index: number, role: EdgeRole) => void;
  onInputChange: () => void;
  onBack: () => void;
  onCalculate: () => void;
  onNext: () => void;
  hasParcelResult: boolean;
}

export function FacadeSetbacks({
  edges,
  edgeRoles,
  edgeSetbacks,
  setEdgeSetbacks,
  edgeOverhangs,
  setEdgeOverhangs,
  edgeOverhangActive,
  setEdgeOverhangActive,
  parcelVertices,
  localFootprintVertices,
  calculationResult,
  visualOverhangVertices,
  setbacks,
  maxOverhangs,
  rotationDegrees,
  setRotationDegrees,
  floorOptions,
  selectedFloorOption,
  setSelectedFloorOption,
  calculationError,
  isCalculatingResult,
  onRoleChange,
  onInputChange,
  onBack,
  onCalculate,
  onNext,
  hasParcelResult,
}: FacadeSetbacksProps) {
  const hasInvalidOverhang = edgeOverhangs.some((value, index) => (
    (edgeOverhangActive[index] ?? true) && (parseFloat(String(value)) || 0) > 1.5
  ));

  return (
    <StackWrapper>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '7fr 5fr' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Card variant="outlined" sx={{ borderRadius: 1, borderColor: '#e2e8f0' }}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Cephe Rolleri & Çekmeler
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: 12, mb: 2 }}>
              Her kenar için rol, bahçe çekmesi ve çıkma mesafesini belirleyin.
            </Typography>

            <TableContainer>
              <Table size="small" sx={{ '& td': { py: 0.75, px: 1, fontSize: 12 }, '& th': { py: 0.75, px: 1, fontSize: 11 } }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    <TableCell sx={{ fontSize: 11, fontWeight: 600 }}>Kenar</TableCell>
                    <TableCell sx={{ fontSize: 11, fontWeight: 600 }}>Uzunluk</TableCell>
                    <TableCell sx={{ fontSize: 11, fontWeight: 600 }}>Rol</TableCell>
                    <TableCell sx={{ fontSize: 11, fontWeight: 600 }}>Çekme (m)</TableCell>
                    <TableCell sx={{ fontSize: 11, fontWeight: 600 }}>Çıkma (m)</TableCell>
                    <TableCell sx={{ fontSize: 11, fontWeight: 600 }}>Aktif</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {edges.map((edge, index) => {
                    const role = edgeRoles[index] ?? 'side';
                    const isInactive = role === 'inactive';
                    const overhang = parseFloat(String(edgeOverhangs[index] ?? 1.5)) || 1.5;
                    const isOverhangActive = edgeOverhangActive[index] ?? true;

                    return (
                      <TableRow
                        key={`${edge.label}-${index}`}
                        sx={{
                          opacity: isInactive ? 0.5 : 1,
                          bgcolor: isInactive ? '#fafafa' : 'white',
                        }}
                      >
                        <TableCell>
                          <Chip
                            label={edge.label || String.fromCharCode(65 + index)}
                            size="small"
                            sx={{ fontSize: 10, height: 20 }}
                          />
                          {edge.length < 500 ? (
                            <Chip label="Kısa" size="small" sx={{ fontSize: 9, height: 18, ml: 0.5, opacity: 0.6 }} />
                          ) : null}
                        </TableCell>

                        <TableCell>
                          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                            {(edge.length / 100).toFixed(2)} m
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <ButtonGroup size="small">
                            {edgeRoleOptions.map((option) => (
                              <Button
                                key={option.role}
                                size="small"
                                onClick={() => onRoleChange(index, option.role)}
                                sx={{
                                  fontSize: 10,
                                  px: 0.75,
                                  py: 0.25,
                                  minWidth: 36,
                                  bgcolor: role === option.role ? option.color : 'transparent',
                                  color: role === option.role ? 'white' : option.color,
                                  borderColor: option.color,
                                  '&:hover': { bgcolor: option.color, color: 'white' },
                                }}
                              >
                                {option.label}
                              </Button>
                            ))}
                          </ButtonGroup>
                        </TableCell>

                        <TableCell>
                          {isInactive ? (
                            <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>—</Typography>
                          ) : (
                            <Box>
                              <TextField
                                size="small"
                                type="text"
                                value={edgeSetbacks[index] ?? ''}
                                onChange={(event) => {
                                  const raw = event.target.value;
                                  if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                                    setEdgeSetbacks((current) => {
                                      const next = [...current];
                                      next[index] = raw;
                                      return next;
                                    });
                                    onInputChange();
                                  }
                                }}
                                inputProps={{
                                  inputMode: 'decimal',
                                  style: { fontSize: 11, padding: '3px 6px' },
                                }}
                                sx={{ width: 64 }}
                              />
                              {role === 'front' && (parseFloat(String(edgeSetbacks[index] ?? 5)) || 5) < 5 ? (
                                <Typography sx={{ fontSize: 9, color: 'warning.main', mt: 0.3 }}>
                                  Min 5m önerilir
                                </Typography>
                              ) : null}
                            </Box>
                          )}
                        </TableCell>

                        <TableCell>
                          {isInactive ? (
                            <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>—</Typography>
                          ) : (
                            <TextField
                              size="small"
                              type="text"
                              value={edgeOverhangs[index] ?? ''}
                              onChange={(event) => {
                                const raw = event.target.value;
                                if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                                  if ((parseFloat(raw) || 0) > 1.5) return;
                                  setEdgeOverhangs((current) => {
                                    const next = [...current];
                                    next[index] = raw;
                                    return next;
                                  });
                                  onInputChange();
                                }
                              }}
                              inputProps={{
                                inputMode: 'decimal',
                                style: { fontSize: 11, padding: '3px 6px' },
                              }}
                              sx={{ width: 64 }}
                              helperText={
                                overhang > 1.5
                                  ? <span style={{ fontSize: 9, color: 'red' }}>Max 1.5m</span>
                                  : undefined
                              }
                            />
                          )}
                        </TableCell>

                        <TableCell>
                          <Switch
                            size="small"
                            checked={isOverhangActive}
                            onChange={() => {
                              setEdgeOverhangActive((current) => {
                                const next = [...current];
                                next[index] = !next[index];
                                return next;
                              });
                              onInputChange();
                            }}
                            disabled={isInactive}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {!edgeRoles.includes('front') && (
              <Alert severity="warning" sx={{ fontSize: 11, py: 0.5, mt: 1 }}>
                Henüz yol cephesi seçilmedi. Lütfen yola bakan kenar için &quot;Yol&quot; rolünü seçin.
                Ön bahçe çekmesi bu kenara uygulanacaktır.
              </Alert>
            )}

            <Alert severity="info" sx={{ mt: 2, fontSize: 12, py: 0.5 }}>
              Zemin kat çıkma almaz. Max çıkma 1,50 m.
            </Alert>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ height: '100%', borderRadius: 1, borderColor: '#e2e8f0' }}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Arsa Görünümü
            </Typography>
            <Box sx={{ width: '100%', overflowX: 'auto' }}>
              <ParcelVisualization
                parcelVertices={parcelVertices}
                footprintVertices={localFootprintVertices ?? calculationResult?.footprintVertices ?? undefined}
                overhangVertices={visualOverhangVertices}
                width={380}
                height={340}
                showLabels={false}
                showLegend={false}
                showSetbackAnnotations={localFootprintVertices != null && localFootprintVertices.length > 0}
                showOverhangAnnotations={(visualOverhangVertices?.length ?? 0) > 0}
                setbacks={setbacks}
                maxOverhangs={maxOverhangs}
                edgeRoles={edgeRoles}
                edgeSetbacks={edgeSetbacks.map((value) => parseFloat(String(value)) || 0)}
                edgeOverhangs={edgeOverhangs.map((value, index) => (
                  (edgeOverhangActive[index] ?? true) ? (parseFloat(String(value)) || 0) : 0
                ))}
                rotationDeg={rotationDegrees}
              />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 0.5 }}>
              <IconButton size="small" onClick={() => setRotationDegrees((current) => current - 15)}>
                <RotateLeftIcon fontSize="small" />
              </IconButton>
              <Typography fontSize={11} sx={{ alignSelf: 'center', minWidth: 28, textAlign: 'center' }}>
                {rotationDegrees}°
              </Typography>
              <IconButton size="small" onClick={() => setRotationDegrees((current) => current + 15)}>
                <RotateRightIcon fontSize="small" />
              </IconButton>
              {rotationDegrees !== 0 && (
                <IconButton size="small" onClick={() => setRotationDegrees(0)}>
                  <RestartAltIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
          Kat Sayısı
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
          {floorOptions.map((option, index) => (
            <Card
              key={`${option.title}-${option.coverageRatio}`}
              variant="outlined"
              onClick={() => {
                setSelectedFloorOption(index as FloorOptionIndex);
                onInputChange();
              }}
              sx={{
                cursor: 'pointer',
                borderColor: selectedFloorOption === index ? 'primary.main' : 'divider',
                bgcolor: selectedFloorOption === index ? 'primary.50' : 'white',
                transition: 'all 0.15s',
                '&:hover': { borderColor: 'primary.main' },
              }}
            >
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>
                  {option.title}
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  TAKS {option.coverageRatio}
                </Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 700, mt: 0.5 }}>
                  {option.footprintArea.toFixed(0)} m² taban
                </Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  {option.floorCount} kat
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Box>

      {calculationError ? <Alert severity="error" sx={{ fontSize: 12, py: 0.5 }}>{calculationError}</Alert> : null}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Button size="small" variant="outlined" onClick={onBack}>
          ← Geri
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={() => {
            onCalculate();
            onNext();
          }}
          disabled={!hasParcelResult || isCalculatingResult || hasInvalidOverhang}
        >
          {isCalculatingResult ? 'Hesaplanıyor...' : 'Hesapla →'}
        </Button>
      </Box>
    </StackWrapper>
  );
}

function StackWrapper({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {children}
    </Box>
  );
}
