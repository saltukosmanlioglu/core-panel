'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Box,
  Button,
  CircularProgress,
  Step,
  StepLabel,
  Stepper,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import SaveIcon from '@mui/icons-material/Save';
import axios from 'axios';
import type { FloorType, MetrajTakeoff, RoughConstruction } from '@core-panel/shared';
import { Notification } from '@/components';
import { getParcelCalculations } from '@/services/parcel-calculations/api';
import { getMetrajTakeoff, saveMetrajTakeoff } from '@/services/metraj/api';
import type { ParcelCalculation } from '@/services/parcel-calculations/types';
import { getProjectApi } from '@/services/workspace/api';
import { exportMetrajToExcel } from '@/utils/exportMetraj';
import { normalizeRoughConstruction } from '@/utils/roughConstruction';
import { FloorTypeCard } from './components/FloorTypeCard';
import { RoughConstructionSection, RoughConstructionSummaryTable } from './components/RoughConstructionSection';
import { SummaryTable } from './components/SummaryTable';
import { SubcontractorMetrajTable } from './components/SubcontractorMetrajTable';

const STEPS = ['Veri Girişi', 'Hesaplama Özeti', 'Taşeron Metrajı'];

function newFloorType(label: string): FloorType {
  return { id: crypto.randomUUID(), label, quantity: 1, rooms: [], openings: [] };
}

export default function MetrajPage() {
  const { id: projectId } = useParams<{ id: string }>();

  const [projectName, setProjectName] = useState('');
  const [floorTypes, setFloorTypes] = useState<FloorType[]>([]);
  const [roughConstruction, setRoughConstruction] = useState<RoughConstruction | null>(null);
  const [takeoff, setTakeoff] = useState<MetrajTakeoff | null>(null);
  const [latestParcelCalc, setLatestParcelCalc] = useState<ParcelCalculation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [activeInputTab, setActiveInputTab] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'error' as 'error' | 'success' });

  const showError = (message: string) => setSnackbar({ open: true, message, severity: 'error' });
  const showSuccess = (message: string) => setSnackbar({ open: true, message, severity: 'success' });

  useEffect(() => {
    Promise.all([
      getMetrajTakeoff(projectId),
      getParcelCalculations(projectId),
      getProjectApi(projectId),
    ])
      .then(([existing, calcs, project]) => {
        setProjectName(project.name);
        const latestCalc = calcs[0] ?? null;
        setLatestParcelCalc(latestCalc);
        if (existing) {
          setTakeoff(existing);
          setFloorTypes(existing.floorTypes);
          setRoughConstruction(normalizeRoughConstruction(
            existing.roughConstruction,
            latestCalc?.footprintArea,
            latestCalc?.floorCount,
          ));
        } else {
          setFloorTypes([newFloorType('Zemin Kat'), newFloorType('Normal Kat')]);
          setRoughConstruction(normalizeRoughConstruction(null, latestCalc?.footprintArea, latestCalc?.floorCount));
        }
      })
      .catch((err: unknown) => {
        const msg = axios.isAxiosError(err)
          ? ((err.response?.data as { error?: string })?.error ?? 'Veriler yüklenemedi')
          : 'Veriler yüklenemedi';
        showError(msg);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveMetrajTakeoff(projectId, {
        name: takeoff?.name ?? 'Metraj',
        parcelCalculationId: latestParcelCalc?.id ?? null,
        floorTypes,
        roughConstruction,
      });
      setTakeoff(saved);
      showSuccess('Metraj kaydedildi.');
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? ((err.response?.data as { error?: string })?.error ?? 'Kaydetme başarısız')
        : 'Kaydetme başarısız';
      showError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportMetrajToExcel(projectName || 'Proje', floorTypes, roughConstruction);
    } finally {
      setExporting(false);
    }
  };

  const updateFloorType = useCallback((id: string, updated: FloorType) => {
    setFloorTypes(prev => prev.map(ft => ft.id === id ? updated : ft));
  }, []);

  const removeFloorType = useCallback((id: string) => {
    setFloorTypes(prev => prev.filter(ft => ft.id !== id));
  }, []);

  const addFloorType = () => {
    setFloorTypes(prev => [...prev, newFloorType('Yeni Kat')]);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
        <CircularProgress sx={{ color: '#1F2937' }} />
      </Box>
    );
  }

  const goNext = () => setActiveStep(step => Math.min(step + 1, STEPS.length - 1));
  const goBack = () => setActiveStep(step => Math.max(step - 1, 0));

  return (
    <>
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>Metraj</Typography>
            <Typography variant="body2" sx={{ color: '#6B7280' }}>
              Kaba ve ince inşaat metrajlarını yönetin.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              variant="outlined"
              startIcon={exporting ? <CircularProgress size={16} /> : <DownloadIcon />}
              onClick={handleExport}
              disabled={exporting || (floorTypes.length === 0 && !roughConstruction)}
              sx={{ borderColor: '#D1D5DB', color: '#374151', textTransform: 'none' }}
            >
              Excel İndir
            </Button>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving}
              sx={{ bgcolor: '#1F2937', '&:hover': { bgcolor: '#374151' }, textTransform: 'none' }}
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </Box>
        </Box>

        <Box sx={{ border: '1px solid #E5E7EB', borderRadius: 2, mb: 3, p: { xs: 1.5, md: 2 }, backgroundColor: '#FFFFFF' }}>
          <Stepper activeStep={activeStep} alternativeLabel sx={{ '& .MuiStepLabel-label': { fontSize: 13, fontWeight: 600 } }}>
            {STEPS.map(label => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        {activeStep === 0 && (
          <Box>
            <Box sx={{ borderBottom: '1px solid #E5E7EB', mb: 2.5 }}>
              <Tabs
                value={activeInputTab}
                onChange={(_, value: number) => setActiveInputTab(value)}
                sx={{ '& .MuiTab-root': { textTransform: 'none', fontWeight: 700 } }}
              >
                <Tab label="Kaba İnşaat" />
                <Tab label="İnce İnşaat" />
              </Tabs>
            </Box>

            {activeInputTab === 0 && roughConstruction && (
              <RoughConstructionSection
                roughConstruction={roughConstruction}
                onChange={setRoughConstruction}
              />
            )}

            {activeInputTab === 1 && (
              <Box>
                {floorTypes.map(ft => (
                  <FloorTypeCard
                    key={ft.id}
                    floorType={ft}
                    onChange={updated => updateFloorType(ft.id, updated)}
                    onDelete={() => removeFloorType(ft.id)}
                  />
                ))}
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={addFloorType}
                  sx={{ mt: 0.5, borderColor: '#D1D5DB', color: '#374151', textTransform: 'none', width: '100%' }}
                >
                  Kat Tipi Ekle
                </Button>
              </Box>
            )}
          </Box>
        )}

        {activeStep === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {roughConstruction && (
              <RoughConstructionSummaryTable
                roughConstruction={roughConstruction}
                onChange={setRoughConstruction}
              />
            )}

            <Box sx={{ border: '1px solid #E5E7EB', borderRadius: 2, overflow: 'hidden' }}>
              <Box sx={{ px: 2, py: 1.5, backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>İnce İnşaat Özeti</Typography>
              </Box>
              <Box sx={{ p: { xs: 1.5, md: 2 } }}>
                <SummaryTable
                  floorTypes={floorTypes}
                  parcelFootprintArea={latestParcelCalc?.footprintArea ?? null}
                />
              </Box>
            </Box>
          </Box>
        )}

        {activeStep === 2 && (
          <Box sx={{ border: '1px solid #E5E7EB', borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1.5, backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Taşeron Metrajı</Typography>
            </Box>
            <Box sx={{ p: { xs: 1.5, md: 2 } }}>
              <SubcontractorMetrajTable floorTypes={floorTypes} />
            </Box>
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button
            variant="outlined"
            onClick={goBack}
            disabled={activeStep === 0}
            sx={{ borderColor: '#D1D5DB', color: '#374151', textTransform: 'none' }}
          >
            Geri
          </Button>
          <Button
            variant="contained"
            onClick={goNext}
            disabled={activeStep === STEPS.length - 1}
            sx={{ bgcolor: '#1F2937', '&:hover': { bgcolor: '#374151' }, textTransform: 'none' }}
          >
            İleri
          </Button>
        </Box>
      </Box>

      <Notification
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
      />
    </>
  );
}
