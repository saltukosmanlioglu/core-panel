'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  AutoAwesome as AutoAwesomeIcon,
  Close as CloseIcon,
  DeleteOutline as DeleteOutlineIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Fullscreen as FullscreenIcon,
  Replay as ReplayIcon,
} from '@mui/icons-material';
import { useSnackbar } from '@/hooks/useSnackbar';
import { Notification } from '@/components';
import {
  deleteFloorPlanApi,
  generateFloorPlanApi,
  getFloorPlanXmlUrl,
  getFloorPlansApi,
  regenerateFloorPlanApi,
} from '@/services/floor-plans/api';
import { getErrorMessage } from '@/utils/getErrorMessage';
import type { FloorPlan, GenerateFloorPlanPayload } from '@/services/floor-plans/types';

const ROOM_TYPES = [
  { value: 'studio', label: 'Stüdyo' },
  { value: '1+1', label: '1+1' },
  { value: '2+1', label: '2+1' },
  { value: '3+1', label: '3+1' },
  { value: '4+1', label: '4+1' },
];

const STATUS_CHIP: Record<string, { label: string; color: 'default' | 'success' | 'warning' | 'error' }> = {
  draft: { label: 'Taslak', color: 'default' },
  ready: { label: 'Hazır', color: 'success' },
  failed: { label: 'Hata', color: 'error' },
};

function FloorPlanStatusChip({ status }: { status: string }) {
  const cfg = STATUS_CHIP[status] ?? { label: status, color: 'default' as const };
  return <Chip label={cfg.label} color={cfg.color} size="small" />;
}

export default function FloorPlanPage() {
  const params = useParams();
  const projectId = String(params.id);
  const { showSuccess, showError, notificationProps } = useSnackbar();

  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const [generateOpen, setGenerateOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState<GenerateFloorPlanPayload>({
    apartmentCount: 2,
    roomType: '2+1',
    floorNumber: 1,
  });

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorUrl, setEditorUrl] = useState<string | null>(null);
  const [editorTitle, setEditorTitle] = useState('');

  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getFloorPlansApi(projectId);
      setFloorPlans(data);
    } catch (err) {
      showError(getErrorMessage(err, 'Kat planları yüklenemedi'));
    } finally {
      setLoading(false);
    }
  }, [projectId]); // showError is excluded — it wraps setSnackbar which is stable

  useEffect(() => {
    void load();
  }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { floorPlan, editorUrl: url } = await generateFloorPlanApi(projectId, form);
      setFloorPlans((prev) => [{ ...floorPlan, editorUrl: url }, ...prev]);
      setGenerateOpen(false);
      showSuccess('Kat planı oluşturuldu');
      if (url) {
        setEditorUrl(url);
        setEditorTitle(floorPlan.name);
        setEditorOpen(true);
      }
    } catch (err) {
      showError(getErrorMessage(err, 'Kat planı oluşturulamadı'));
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = async (fp: FloorPlan) => {
    setRegeneratingId(fp.id);
    try {
      const { floorPlan, editorUrl: url } = await regenerateFloorPlanApi(fp.id);
      setFloorPlans((prev) => prev.map((p) => (p.id === fp.id ? { ...floorPlan, editorUrl: url } : p)));
      showSuccess('Kat planı yenilendi');
      if (url) {
        setEditorUrl(url);
        setEditorTitle(floorPlan.name);
        setEditorOpen(true);
      }
    } catch (err) {
      showError(getErrorMessage(err, 'Yenileme başarısız'));
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleDelete = async (fp: FloorPlan) => {
    setDeletingId(fp.id);
    try {
      await deleteFloorPlanApi(fp.id);
      setFloorPlans((prev) => prev.filter((p) => p.id !== fp.id));
      showSuccess('Kat planı silindi');
    } catch (err) {
      showError(getErrorMessage(err, 'Silme başarısız'));
    } finally {
      setDeletingId(null);
    }
  };

  const openEditor = (fp: FloorPlan) => {
    if (!fp.editorUrl) return;
    setEditorUrl(fp.editorUrl);
    setEditorTitle(fp.name);
    setEditorOpen(true);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Kat Planı
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setGenerateOpen(true)}>
          Yeni Kat Planı Oluştur
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 2 }}>
          {[1, 2].map((k) => (
            <Skeleton key={k} variant="rounded" height={180} />
          ))}
        </Box>
      ) : floorPlans.length === 0 ? (
        <Alert severity="info" icon={<AutoAwesomeIcon />}>
          Henüz kat planı yok. Yapay zeka ile ilk kat planınızı oluşturun.
        </Alert>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 2 }}>
          {floorPlans.map((fp) => (
            <Card key={fp.id} variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography variant="subtitle1" fontWeight={600} noWrap sx={{ maxWidth: '70%' }}>
                    {fp.name}
                  </Typography>
                  <FloorPlanStatusChip status={fp.status} />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {fp.roomType && `${fp.roomType} · `}
                  {fp.apartmentCount && `${fp.apartmentCount} daire`}
                  {fp.floorNumber != null && ` · Kat ${fp.floorNumber}`}
                </Typography>
                {fp.totalArea && (
                  <Typography variant="body2" color="text.secondary">
                    {fp.totalArea} m² inşaat alanı
                  </Typography>
                )}
              </CardContent>
              <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                <Tooltip title="SH3D dosyasını indir">
                  <IconButton
                    size="small"
                    component="a"
                    href={getFloorPlanXmlUrl(fp.id)}
                    download={`${fp.name}.sh3d`}
                  >
                    <DownloadIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {fp.editorUrl && (
                  <Tooltip title="Sweet Home 3D ile düzenle">
                    <IconButton size="small" onClick={() => openEditor(fp)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Yeniden oluştur">
                  <IconButton
                    size="small"
                    disabled={regeneratingId === fp.id}
                    onClick={() => handleRegenerate(fp)}
                  >
                    {regeneratingId === fp.id ? (
                      <CircularProgress size={16} />
                    ) : (
                      <ReplayIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Sil">
                  <IconButton
                    size="small"
                    color="error"
                    disabled={deletingId === fp.id}
                    onClick={() => handleDelete(fp)}
                  >
                    {deletingId === fp.id ? (
                      <CircularProgress size={16} color="error" />
                    ) : (
                      <DeleteOutlineIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              </CardActions>
            </Card>
          ))}
        </Box>
      )}

      {/* Generate Dialog */}
      <Dialog open={generateOpen} onClose={() => !generating && setGenerateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Kat Planı Oluştur
            <IconButton size="small" onClick={() => setGenerateOpen(false)} disabled={generating}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Daire Tipi</InputLabel>
              <Select
                label="Daire Tipi"
                value={form.roomType}
                onChange={(e) => setForm((f) => ({ ...f, roomType: e.target.value }))}
              >
                {ROOM_TYPES.map((r) => (
                  <MenuItem key={r.value} value={r.value}>
                    {r.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Kat Başına Daire Sayısı"
              type="number"
              size="small"
              fullWidth
              inputProps={{ min: 1, max: 8 }}
              value={form.apartmentCount}
              onChange={(e) =>
                setForm((f) => ({ ...f, apartmentCount: Math.max(1, parseInt(e.target.value) || 1) }))
              }
            />
            <TextField
              label="Kat Numarası"
              type="number"
              size="small"
              fullWidth
              inputProps={{ min: 1 }}
              value={form.floorNumber ?? 1}
              onChange={(e) =>
                setForm((f) => ({ ...f, floorNumber: Math.max(1, parseInt(e.target.value) || 1) }))
              }
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerateOpen(false)} disabled={generating}>
            İptal
          </Button>
          <Button
            variant="contained"
            startIcon={generating ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
            disabled={generating}
            onClick={handleGenerate}
          >
            {generating ? 'Oluşturuluyor…' : 'Oluştur'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* SH3D Editor Dialog */}
      <Dialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        maxWidth={false}
        fullWidth
        PaperProps={{ sx: { width: '95vw', height: '90vh', m: 1 } }}
      >
        <DialogTitle sx={{ py: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1" fontWeight={600}>
              {editorTitle}
            </Typography>
            <Box>
              <Tooltip title="Yeni sekmede aç">
                <IconButton
                  size="small"
                  component="a"
                  href={editorUrl ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FullscreenIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <IconButton size="small" onClick={() => setEditorOpen(false)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {editorUrl && (
            <iframe
              src={editorUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Sweet Home 3D Editor"
              allow="fullscreen"
            />
          )}
        </DialogContent>
      </Dialog>

      <Notification {...notificationProps} />
    </Box>
  );
}
