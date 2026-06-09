'use client';

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/GridLegacy';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type {
  ConcreteClass,
  RoughBeamInput,
  RoughColumnInput,
  RoughConstruction,
  RoughConstructionFloorType,
} from '@core-panel/shared';
import {
  calculateRoughConstructionSummary,
  CONCRETE_CLASSES,
  createRoughBeam,
  type RoughSummaryRow,
} from '@/utils/roughConstruction';
import { MetrajNumberField, metrajInputSx, smallTextFieldInputProps } from './MetrajFormFields';

const rowPaperSx = { p: 1.5, border: '1px solid #E5E7EB', boxShadow: 'none' };
const outputSx = {
  p: 1.25,
  minHeight: 42,
  border: '1px solid #BAE6FD',
  backgroundColor: '#F0F9FF',
  textAlign: 'right',
};
const hCell = {
  fontWeight: 700,
  fontSize: 12,
  color: '#374151',
  backgroundColor: '#F3F4F6',
  py: 1,
  px: 1.5,
  whiteSpace: 'nowrap' as const,
};
const dCell = { fontSize: 13, py: 0.85, px: 1.5 };
const totalCell = {
  fontWeight: 700,
  fontSize: 13,
  backgroundColor: '#1F2937',
  color: '#FFFFFF',
  py: 1,
  px: 1.5,
};

interface Props {
  roughConstruction: RoughConstruction;
  onChange: (updated: RoughConstruction) => void;
}

function n2(value: number): string {
  return value.toFixed(2);
}

function n3(value: number): string {
  return value.toFixed(3);
}

function concreteField(label: string, value: ConcreteClass, onChange: (value: ConcreteClass) => void) {
  return (
    <TextField
      fullWidth
      select
      size="small"
      label={label}
      value={value}
      onChange={event => onChange(event.target.value as ConcreteClass)}
      inputProps={smallTextFieldInputProps}
      sx={metrajInputSx}
    >
      {CONCRETE_CLASSES.map(item => (
        <MenuItem key={item} value={item} sx={{ fontSize: 13 }}>{item}</MenuItem>
      ))}
    </TextField>
  );
}

function numberField(label: string, value: number, onChange: (value: number) => void) {
  return (
    <MetrajNumberField
      fullWidth
      label={label}
      value={value}
      onChange={onChange}
    />
  );
}

function slabVolume(floorType: RoughConstructionFloorType): number {
  return floorType.slab.areaSqm * floorType.slab.thicknessM * floorType.quantity;
}

function wallVolume(floorType: RoughConstructionFloorType): number {
  const wall = floorType.basementWall;
  if (!wall) return 0;
  return wall.perimeterM * wall.thicknessM * wall.heightM * floorType.quantity;
}

function columnVolume(floorType: RoughConstructionFloorType): number {
  const column = floorType.column;
  return column.widthM * column.depthM * floorType.ceilingHeightM * column.quantity * floorType.quantity;
}

function beamVolume(floorType: RoughConstructionFloorType, beam: RoughBeamInput): number {
  return beam.widthM * beam.heightM * beam.totalLengthM * floorType.quantity;
}

function QuantityOutput({ value }: { value: number }) {
  return (
    <Paper variant="outlined" sx={outputSx}>
      <Typography variant="caption" sx={{ color: '#0369A1' }}>Miktar (m³)</Typography>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>{n3(value)}</Typography>
    </Paper>
  );
}

export function RoughConstructionSection({ roughConstruction, onChange }: Props) {
  const updateFloorType = (floorTypeId: string, patch: Partial<RoughConstructionFloorType>) => {
    onChange({
      ...roughConstruction,
      floorTypes: roughConstruction.floorTypes.map(floorType => {
        if (floorType.id !== floorTypeId) return floorType;
        const next = { ...floorType, ...patch };
        return next.key === 'ground' ? { ...next, quantity: 1 } : next;
      }),
    });
  };

  const updateColumn = (floorType: RoughConstructionFloorType, patch: Partial<RoughColumnInput>) => {
    updateFloorType(floorType.id, {
      column: { ...floorType.column, ...patch },
    });
  };

  const updateBeam = (floorType: RoughConstructionFloorType, beamId: string, patch: Partial<RoughBeamInput>) => {
    updateFloorType(floorType.id, {
      beams: floorType.beams.map(beam => beam.id === beamId ? { ...beam, ...patch } : beam),
    });
  };

  return (
    <Box>
      {roughConstruction.floorTypes.map(floorType => (
        <Accordion key={floorType.id} defaultExpanded disableGutters sx={{ border: '1px solid #E5E7EB', borderRadius: '8px !important', mb: 1.5, '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2, minHeight: 64 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {floorType.label} · {floorType.quantity} kat
            </Typography>
          </AccordionSummary>

          <AccordionDetails sx={{ px: 2, pb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
              Kat Bilgisi
            </Typography>
            <Grid container spacing={1.5} alignItems="center">
              <Grid item xs={12} md={3}>
                <MetrajNumberField
                  fullWidth
                  label="Tavan yüksekliği (m)"
                  value={floorType.ceilingHeightM}
                  onChange={value => updateFloorType(floorType.id, { ceilingHeightM: value })}
                />
              </Grid>
              {floorType.key !== 'ground' && (
                <Grid item xs={12} md={3}>
                  <MetrajNumberField
                    fullWidth
                    label="Kat adedi"
                    value={floorType.quantity}
                    onChange={value => updateFloorType(floorType.id, { quantity: value })}
                  />
                </Grid>
              )}
            </Grid>

            <Divider sx={{ my: 2.5 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
              Döşeme
            </Typography>
            <Grid container spacing={1.5} alignItems="center">
              <Grid item xs={12} md={3}>
                {numberField('Alan (m²)', floorType.slab.areaSqm, value => updateFloorType(floorType.id, { slab: { ...floorType.slab, areaSqm: value } }))}
              </Grid>
              <Grid item xs={12} md={3}>
                {numberField('Kalınlık (m)', floorType.slab.thicknessM, value => updateFloorType(floorType.id, { slab: { ...floorType.slab, thicknessM: value } }))}
              </Grid>
              <Grid item xs={12} md={3}>
                {concreteField('Beton sınıfı', floorType.slab.concreteClass, value => updateFloorType(floorType.id, { slab: { ...floorType.slab, concreteClass: value } }))}
              </Grid>
              <Grid item xs={12} md={3}>
                <QuantityOutput value={slabVolume(floorType)} />
              </Grid>
            </Grid>

            {floorType.key === 'basement' && floorType.basementWall && (
              <>
                <Divider sx={{ my: 2.5 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                  Perde Beton
                </Typography>
                <Grid container spacing={1.5} alignItems="center">
                  <Grid item xs={12} md={2.4}>
                    {numberField('Çevre uzunluğu (m)', floorType.basementWall.perimeterM, value => updateFloorType(floorType.id, { basementWall: { ...floorType.basementWall!, perimeterM: value } }))}
                  </Grid>
                  <Grid item xs={12} md={2.4}>
                    {numberField('Perde kalınlığı (m)', floorType.basementWall.thicknessM, value => updateFloorType(floorType.id, { basementWall: { ...floorType.basementWall!, thicknessM: value } }))}
                  </Grid>
                  <Grid item xs={12} md={2.4}>
                    {numberField('Perde yüksekliği (m)', floorType.basementWall.heightM, value => updateFloorType(floorType.id, { basementWall: { ...floorType.basementWall!, heightM: value } }))}
                  </Grid>
                  <Grid item xs={12} md={2.4}>
                    {concreteField('Beton sınıfı', floorType.basementWall.concreteClass, value => updateFloorType(floorType.id, { basementWall: { ...floorType.basementWall!, concreteClass: value } }))}
                  </Grid>
                  <Grid item xs={12} md={2.4}>
                    <QuantityOutput value={wallVolume(floorType)} />
                  </Grid>
                </Grid>
              </>
            )}

            <Divider sx={{ my: 2.5 }} />
            <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1} sx={{ mb: 1.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Kolonlar
              </Typography>
              <Chip
                size="small"
                label={`Yükseklik: ${n2(floorType.ceilingHeightM)} m`}
                sx={{ height: 24, fontSize: 12, backgroundColor: '#F3F4F6', color: '#374151' }}
              />
            </Stack>
            <Paper variant="outlined" sx={rowPaperSx}>
              <Grid container spacing={1.5} alignItems="center">
                <Grid item xs={12} md={2.2}>{numberField('Kolon en (m)', floorType.column.widthM, value => updateColumn(floorType, { widthM: value }))}</Grid>
                <Grid item xs={12} md={2.2}>{numberField('Kolon boy (m)', floorType.column.depthM, value => updateColumn(floorType, { depthM: value }))}</Grid>
                <Grid item xs={12} md={2.2}>{numberField('Kolon adedi', floorType.column.quantity, value => updateColumn(floorType, { quantity: value }))}</Grid>
                <Grid item xs={12} md={2.2}>{concreteField('Beton sınıfı', floorType.column.concreteClass, value => updateColumn(floorType, { concreteClass: value }))}</Grid>
                <Grid item xs={12} md={3.2}>
                  <QuantityOutput value={columnVolume(floorType)} />
                </Grid>
              </Grid>
            </Paper>

            <Divider sx={{ my: 2.5 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
              Kirişler
            </Typography>
            <Stack spacing={1.25}>
              {floorType.beams.map((beam, index) => (
                <Paper key={beam.id} variant="outlined" sx={rowPaperSx}>
                  <Grid container spacing={1.5} alignItems="center">
                    <Grid item xs={12} md={2.5}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Ad"
                        value={beam.label}
                        onChange={event => updateBeam(floorType, beam.id, { label: event.target.value })}
                        placeholder={`Kiriş ${index + 1}`}
                        inputProps={smallTextFieldInputProps}
                        sx={metrajInputSx}
                      />
                    </Grid>
                    <Grid item xs={12} md={1.7}>{numberField('Genişlik (m)', beam.widthM, value => updateBeam(floorType, beam.id, { widthM: value }))}</Grid>
                    <Grid item xs={12} md={1.7}>{numberField('Yükseklik (m)', beam.heightM, value => updateBeam(floorType, beam.id, { heightM: value }))}</Grid>
                    <Grid item xs={12} md={2}>{numberField('Toplam uzunluk (m)', beam.totalLengthM, value => updateBeam(floorType, beam.id, { totalLengthM: value }))}</Grid>
                    <Grid item xs={12} md={1.6}>{concreteField('Beton', beam.concreteClass, value => updateBeam(floorType, beam.id, { concreteClass: value }))}</Grid>
                    <Grid item xs={12} md={2}>
                      <QuantityOutput value={beamVolume(floorType, beam)} />
                    </Grid>
                    <Grid item xs={12} md={0.5} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
                      <Tooltip title="Kirişi sil">
                        <IconButton size="small" onClick={() => updateFloorType(floorType.id, { beams: floorType.beams.filter(item => item.id !== beam.id) })} sx={{ color: '#9CA3AF' }}>
                          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Grid>
                  </Grid>
                </Paper>
              ))}
            </Stack>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => updateFloorType(floorType.id, { beams: [...floorType.beams, createRoughBeam(`Kiriş ${floorType.beams.length + 1}`, floorType.slab.concreteClass)] })}
              sx={{ color: '#6B7280', textTransform: 'none', fontSize: 12, mt: 1.25 }}
            >
              Kiriş tipi ekle
            </Button>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}

export function RoughConstructionSummaryTable({ roughConstruction, onChange }: Props) {
  const summary = calculateRoughConstructionSummary(roughConstruction);

  const updateFloorType = (floorTypeId: string, patch: Partial<RoughConstructionFloorType>) => {
    onChange({
      ...roughConstruction,
      floorTypes: roughConstruction.floorTypes.map(floorType => {
        if (floorType.id !== floorTypeId) return floorType;
        const next = { ...floorType, ...patch };
        return next.key === 'ground' ? { ...next, quantity: 1 } : next;
      }),
    });
  };

  const updateBeam = (floorType: RoughConstructionFloorType, beamId: string, patch: Partial<RoughBeamInput>) => {
    updateFloorType(floorType.id, {
      beams: floorType.beams.map(beam => beam.id === beamId ? { ...beam, ...patch } : beam),
    });
  };

  const updateSummaryUnitPrice = (row: RoughSummaryRow, unitPrice: number) => {
    const floorType = roughConstruction.floorTypes.find(item => item.id === row.floorTypeId);
    if (!floorType) return;

    if (row.elementType === 'slab') {
      updateFloorType(floorType.id, { slab: { ...floorType.slab, unitPrice } });
      return;
    }

    if (row.elementType === 'basement-wall' && floorType.basementWall) {
      updateFloorType(floorType.id, { basementWall: { ...floorType.basementWall, unitPrice } });
      return;
    }

    if (row.elementType === 'column') {
      updateFloorType(floorType.id, { column: { ...floorType.column, unitPrice } });
      return;
    }

    updateBeam(floorType, row.elementId, { unitPrice });
  };

  return (
    <Box sx={{ border: '1px solid #E5E7EB', borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{ px: 2, py: 1.5, backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Kaba İnşaat Özeti</Typography>
      </Box>
      <Box sx={{ p: { xs: 1.5, md: 2 } }}>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 920, tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={hCell}>Kat Tipi</TableCell>
                <TableCell sx={hCell}>Eleman</TableCell>
                <TableCell sx={{ ...hCell, textAlign: 'right' }}>Miktar (m³)</TableCell>
                <TableCell sx={{ ...hCell, textAlign: 'right' }}>Beton Sınıfı</TableCell>
                <TableCell sx={{ ...hCell, textAlign: 'right' }}>Birim Fiyat</TableCell>
                <TableCell sx={{ ...hCell, textAlign: 'right' }}>Toplam Tutar</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.rows.map((row, index) => (
                <TableRow key={row.id} sx={{ backgroundColor: index % 2 === 0 ? '#FAFAFA' : '#FFFFFF' }}>
                  <TableCell sx={dCell}>{row.floorLabel}</TableCell>
                  <TableCell sx={dCell}>{row.elementLabel}</TableCell>
                  <TableCell sx={{ ...dCell, textAlign: 'right' }}>{n3(row.quantityM3)}</TableCell>
                  <TableCell sx={{ ...dCell, textAlign: 'right', color: '#6B7280' }}>{row.concreteClass}</TableCell>
                  <TableCell sx={{ ...dCell, textAlign: 'right' }}>
                    <MetrajNumberField
                      label="Birim Fiyat"
                      value={row.unitPrice}
                      onChange={value => updateSummaryUnitPrice(row, value)}
                      sx={{ width: 132, ...metrajInputSx }}
                    />
                  </TableCell>
                  <TableCell sx={{ ...dCell, textAlign: 'right', fontWeight: 700 }}>{n2(row.totalCost)}</TableCell>
                </TableRow>
              ))}

              {summary.classTotals.map(total => (
                <TableRow key={total.concreteClass}>
                  <TableCell sx={{ ...dCell, fontWeight: 700 }} colSpan={2}>{total.concreteClass} toplam m³</TableCell>
                  <TableCell sx={{ ...dCell, textAlign: 'right', fontWeight: 700 }}>{n3(total.quantityM3)}</TableCell>
                  <TableCell sx={{ ...dCell, textAlign: 'right', color: '#6B7280' }}>{total.concreteClass}</TableCell>
                  <TableCell sx={dCell} />
                  <TableCell sx={{ ...dCell, textAlign: 'right', fontWeight: 700 }}>{n2(total.totalCost)}</TableCell>
                </TableRow>
              ))}

              <TableRow>
                <TableCell sx={totalCell} colSpan={2}>Genel Toplam</TableCell>
                <TableCell sx={{ ...totalCell, textAlign: 'right' }}>{n3(summary.grandTotalM3)}</TableCell>
                <TableCell sx={totalCell} />
                <TableCell sx={totalCell} />
                <TableCell sx={{ ...totalCell, textAlign: 'right' }}>{n2(summary.grandTotalCost)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>
      </Box>
    </Box>
  );
}
