'use client';

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/GridLegacy';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { FloorType, Opening, OpeningType, Room } from '@core-panel/shared';
import { MetrajNumberField, metrajInputSx, smallTextFieldInputProps } from './MetrajFormFields';

const OPENING_TYPE_LABELS: Record<OpeningType, string> = {
  door: 'Kapı',
  'french-balcony': 'Fransız Balkon',
  window: 'Pencere',
  other: 'Diğer',
};

const OPENING_TYPES: OpeningType[] = ['door', 'french-balcony', 'window', 'other'];

const rowPaperSx = { p: 1.5, border: '1px solid #E5E7EB', boxShadow: 'none' };
const outputSx = {
  p: 1.25,
  minHeight: 40,
  border: '1px solid #BAE6FD',
  backgroundColor: '#F0F9FF',
  textAlign: 'right',
};

function newRoom(): Room {
  return { id: crypto.randomUUID(), name: '', length: 0, width: 0, ceilingHeight: 2.8 };
}

function newOpening(): Opening {
  return { id: crypto.randomUUID(), type: 'door', label: '', width: 0.9, height: 2.1, quantity: 1 };
}

interface Props {
  floorType: FloorType;
  onChange: (updated: FloorType) => void;
  onDelete: () => void;
}

export function FloorTypeCard({ floorType: ft, onChange, onDelete }: Props) {
  const set = (patch: Partial<FloorType>) => onChange({ ...ft, ...patch });

  const updateRoom = (id: string, patch: Partial<Room>) =>
    set({ rooms: ft.rooms.map(r => r.id === id ? { ...r, ...patch } : r) });
  const addRoom = () => set({ rooms: [...ft.rooms, newRoom()] });
  const removeRoom = (id: string) => set({ rooms: ft.rooms.filter(r => r.id !== id) });

  const updateOpening = (id: string, patch: Partial<Opening>) =>
    set({ openings: ft.openings.map(o => o.id === id ? { ...o, ...patch } : o) });
  const addOpening = () => set({ openings: [...ft.openings, newOpening()] });
  const removeOpening = (id: string) => set({ openings: ft.openings.filter(o => o.id !== id) });

  return (
    <Box sx={{ position: 'relative', mb: 1.5 }}>
      <Accordion defaultExpanded disableGutters sx={{ border: '1px solid #E5E7EB', borderRadius: '8px !important', mb: 0, '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2, pr: 9, minHeight: 64 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {ft.label || 'Kat Tipi'} · {ft.quantity} adet
        </Typography>
      </AccordionSummary>

      <AccordionDetails sx={{ px: 2, pb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
          Kat Bilgisi
        </Typography>
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              label="Kat adı"
              value={ft.label}
              onChange={event => set({ label: event.target.value })}
              inputProps={smallTextFieldInputProps}
              sx={metrajInputSx}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <MetrajNumberField
              fullWidth
              label="Adet"
              value={ft.quantity}
              onChange={value => set({ quantity: value })}
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 2.5 }} />

        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
          Odalar
        </Typography>
        <Stack spacing={1.25}>
          {ft.rooms.map((room, index) => (
            <Paper key={room.id} variant="outlined" sx={rowPaperSx}>
              <Grid container spacing={1.5} alignItems="center">
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Ad"
                    value={room.name}
                    onChange={event => updateRoom(room.id, { name: event.target.value })}
                    placeholder={`Oda ${index + 1}`}
                    inputProps={smallTextFieldInputProps}
                    sx={metrajInputSx}
                  />
                </Grid>
                <Grid item xs={12} md={2.5}>
                  <MetrajNumberField
                    fullWidth
                    label="Uzunluk (m)"
                    value={room.length}
                    onChange={value => updateRoom(room.id, { length: value })}
                  />
                </Grid>
                <Grid item xs={12} md={2.5}>
                  <MetrajNumberField
                    fullWidth
                    label="Genişlik (m)"
                    value={room.width}
                    onChange={value => updateRoom(room.id, { width: value })}
                  />
                </Grid>
                <Grid item xs={12} md={2.5}>
                  <MetrajNumberField
                    fullWidth
                    label="Tavan Yük. (m)"
                    value={room.ceilingHeight}
                    onChange={value => updateRoom(room.id, { ceilingHeight: value })}
                  />
                </Grid>
                <Grid item xs={12} md={1.5} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
                  <Tooltip title="Odayı sil">
                    <IconButton size="small" onClick={() => removeRoom(room.id)} sx={{ color: '#9CA3AF' }}>
                      <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Grid>
              </Grid>
            </Paper>
          ))}
        </Stack>
        <Button size="small" startIcon={<AddIcon />} onClick={addRoom} sx={{ color: '#6B7280', textTransform: 'none', fontSize: 12, mt: 1.25 }}>
          Oda ekle
        </Button>

        <Divider sx={{ my: 2.5 }} />

        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
          Boşluklar (Kapı / Pencere)
        </Typography>
        <Stack spacing={1.25}>
          {ft.openings.map((op, index) => (
            <Paper key={op.id} variant="outlined" sx={rowPaperSx}>
              <Grid container spacing={1.5} alignItems="center">
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    select
                    size="small"
                    label="Tür"
                    value={op.type}
                    onChange={event => updateOpening(op.id, { type: event.target.value as OpeningType })}
                    inputProps={smallTextFieldInputProps}
                    sx={metrajInputSx}
                  >
                    {OPENING_TYPES.map(type => (
                      <MenuItem key={type} value={type} sx={{ fontSize: 13 }}>{OPENING_TYPE_LABELS[type]}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={2.25}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Açıklama"
                    value={op.label}
                    onChange={event => updateOpening(op.id, { label: event.target.value })}
                    placeholder={`Boşluk ${index + 1}`}
                    inputProps={smallTextFieldInputProps}
                    sx={metrajInputSx}
                  />
                </Grid>
                <Grid item xs={12} md={1.75}>
                  <MetrajNumberField
                    fullWidth
                    label="Gen. (m)"
                    value={op.width}
                    onChange={value => updateOpening(op.id, { width: value })}
                  />
                </Grid>
                <Grid item xs={12} md={1.75}>
                  <MetrajNumberField
                    fullWidth
                    label="Yük. (m)"
                    value={op.height}
                    onChange={value => updateOpening(op.id, { height: value })}
                  />
                </Grid>
                <Grid item xs={12} md={1.5}>
                  <MetrajNumberField
                    fullWidth
                    label="Adet"
                    value={op.quantity}
                    onChange={value => updateOpening(op.id, { quantity: value })}
                  />
                </Grid>
                <Grid item xs={12} md={1.75}>
                  <Paper variant="outlined" sx={outputSx}>
                    <Typography variant="caption" sx={{ color: '#0369A1' }}>Alan (m²)</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{(op.width * op.height * op.quantity).toFixed(2)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={1} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
                  <Tooltip title="Boşluğu sil">
                    <IconButton size="small" onClick={() => removeOpening(op.id)} sx={{ color: '#9CA3AF' }}>
                      <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Grid>
              </Grid>
            </Paper>
          ))}
        </Stack>
        <Button size="small" startIcon={<AddIcon />} onClick={addOpening} sx={{ color: '#6B7280', textTransform: 'none', fontSize: 12, mt: 1.25 }}>
          Boşluk ekle
        </Button>
      </AccordionDetails>
    </Accordion>

      <Tooltip title="Kat tipini sil">
        <IconButton
          size="small"
          onClick={event => { event.stopPropagation(); onDelete(); }}
          sx={{ position: 'absolute', top: 14, right: 44, zIndex: 2, color: '#EF4444' }}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
