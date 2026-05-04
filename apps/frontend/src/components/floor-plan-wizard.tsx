'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Skeleton,
  Slider,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Apartment as ApartmentIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  AutoAwesome as AutoAwesomeIcon,
  Bathtub as BathtubIcon,
  Business as BusinessIcon,
  CheckCircle as CheckCircleIcon,
  Edit as EditIcon,
  HomeWork as HomeWorkIcon,
  Inventory2 as InventoryIcon,
  KingBed as KingBedIcon,
  Layers as LayersIcon,
  OpenInNew as OpenInNewIcon,
  Remove as RemoveIcon,
  RestartAlt as RestartAltIcon,
  SquareFoot as SquareFootIcon,
  ViewInAr as ViewInArIcon,
} from '@mui/icons-material';
import {
  generateFloorplannerDrawingApi,
  getFloorplannerExportApi,
  provisionFloorplannerProjectApi,
  startFloorplannerExportApi,
} from '@/services/workspace/api';
import type {
  FloorplannerDrawingResult,
  FloorplannerProvisionResult,
} from '@/services/workspace/types';
import { getLatestAreaCalculationApi } from '@/services/area-calculations/api';
import { getProjectFloorPlanExportsApi } from '@/services/floor-plan-exports/api';
import type { AreaCalculation, FloorPlanExport } from '@core-panel/shared';
import { getErrorMessage } from '@/utils/getErrorMessage';

type PropertyType = 'apartment' | 'villa' | 'office';
type KitchenType = 'open' | 'closed';
type GenerationMethod = 'ai' | 'manual';
type ExtraId = 'balcony' | 'homeOffice' | 'laundryRoom' | 'storage' | 'walkInCloset' | 'terrace';

declare global {
  interface Window {
    initFPEditor?: (options: {
      mountSelector: string;
      projectId: number;
      autoSetup: boolean;
      user: {
        id: string;
        auth_token: string;
        permissions: string[];
      };
      language: string;
    }) => void;
  }
}

interface WizardValues {
  propertyType: PropertyType;
  totalArea: number;
  floorCount: number;
  bedrooms: number;
  bathrooms: number;
  kitchenType: KitchenType;
  extras: ExtraId[];
  generationMethod: GenerationMethod | null;
}

interface WizardState {
  currentStep: number;
  values: WizardValues;
}

const stepLabels = ['Mülk', 'Odalar', 'Ekler', 'Yöntem', 'Sonuç'];

const initialValues: WizardValues = {
  propertyType: 'apartment',
  totalArea: 120,
  floorCount: 1,
  bedrooms: 2,
  bathrooms: 1,
  kitchenType: 'open',
  extras: [],
  generationMethod: null,
};

const propertyTypes: Array<{ value: PropertyType; label: string; caption: string; icon: React.ReactNode }> = [
  { value: 'apartment', label: 'Apartman', caption: 'Katlı konut planı', icon: <ApartmentIcon /> },
  { value: 'villa', label: 'Villa', caption: 'Müstakil yaşam alanı', icon: <HomeWorkIcon /> },
  { value: 'office', label: 'Ofis', caption: 'Çalışma ve ekip alanı', icon: <BusinessIcon /> },
];

const extras: Array<{ id: ExtraId; label: string }> = [
  { id: 'balcony', label: 'Balkon' },
  { id: 'homeOffice', label: 'Ev Ofisi' },
  { id: 'laundryRoom', label: 'Çamaşır Odası' },
  { id: 'storage', label: 'Depo' },
  { id: 'walkInCloset', label: 'Giyinme Odası' },
  { id: 'terrace', label: 'Teras' },
];

const propertyTypeLabels: Record<PropertyType, string> = {
  apartment: 'Apartman',
  villa: 'Villa',
  office: 'Ofis',
};

const kitchenLabels: Record<KitchenType, string> = {
  open: 'Açık mutfak',
  closed: 'Kapalı mutfak',
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function CounterControl({
  label,
  value,
  min,
  max,
  icon,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  icon: React.ReactNode;
  onChange: (value: number) => void;
}) {
  return (
    <Box
      sx={{
        border: '1px solid #E5E7EB',
        borderRadius: 2,
        p: 2,
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        gap: 1.5,
        minHeight: 86,
        bgcolor: '#FFFFFF',
      }}
    >
      <Box
        sx={{
          width: 42,
          height: 42,
          borderRadius: 1,
          bgcolor: '#EEF2FF',
          color: '#3730A3',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography sx={{ fontSize: 13, color: '#6B7280', mb: 0.25 }}>{label}</Typography>
        <Typography sx={{ fontSize: 28, lineHeight: 1, fontWeight: 800, color: '#111827' }}>{value}</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Tooltip title="Azalt">
          <span>
            <IconButton
              size="small"
              disabled={value <= min}
              onClick={() => onChange(clamp(value - 1, min, max))}
              sx={{ border: '1px solid #E5E7EB', borderRadius: 1 }}
            >
              <RemoveIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Artır">
          <span>
            <IconButton
              size="small"
              disabled={value >= max}
              onClick={() => onChange(clamp(value + 1, min, max))}
              sx={{ border: '1px solid #E5E7EB', borderRadius: 1 }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
}

function OptionTile({
  selected,
  icon,
  title,
  caption,
  onClick,
}: {
  selected: boolean;
  icon: React.ReactNode;
  title: string;
  caption: string;
  onClick: () => void;
}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        width: '100%',
        minHeight: 112,
        p: 2,
        borderRadius: 2,
        border: selected ? '2px solid #2563EB' : '1px solid #E5E7EB',
        bgcolor: selected ? '#EFF6FF' : '#FFFFFF',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 1.5,
        textAlign: 'left',
        alignItems: 'start',
        color: '#111827',
        cursor: 'pointer',
        transition: 'border-color 0.16s ease, background-color 0.16s ease, transform 0.16s ease',
        '&:hover': {
          borderColor: '#2563EB',
          transform: 'translateY(-1px)',
        },
      }}
    >
      <Box
        sx={{
          width: 42,
          height: 42,
          borderRadius: 1,
          bgcolor: selected ? '#DBEAFE' : '#F3F4F6',
          color: selected ? '#1D4ED8' : '#4B5563',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 800, fontSize: 15 }}>{title}</Typography>
        <Typography sx={{ color: '#6B7280', fontSize: 13, mt: 0.35 }}>{caption}</Typography>
      </Box>
      {selected && <CheckCircleIcon sx={{ color: '#2563EB', fontSize: 22 }} />}
    </Box>
  );
}

function SummaryChips({ values }: { values: WizardValues }) {
  const selectedExtras = extras.filter((extra) => values.extras.includes(extra.id));

  return (
    <Stack direction="row" flexWrap="wrap" gap={1}>
      <Chip label={propertyTypeLabels[values.propertyType]} size="small" />
      <Chip label={`${values.totalArea} m²`} size="small" />
      <Chip label={`${values.floorCount} kat`} size="small" />
      <Chip label={`${values.bedrooms} yatak odası`} size="small" />
      <Chip label={`${values.bathrooms} banyo`} size="small" />
      <Chip label={kitchenLabels[values.kitchenType]} size="small" />
      {selectedExtras.map((extra) => (
        <Chip key={extra.id} label={extra.label} size="small" sx={{ bgcolor: '#ECFDF5', color: '#047857' }} />
      ))}
    </Stack>
  );
}

export function FloorPlanWizard() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const [wizardState, setWizardState] = useState<WizardState>({
    currentStep: 0,
    values: initialValues,
  });
  const [areaCalc, setAreaCalc] = useState<AreaCalculation | null>(null);
  const [areaCalcDismissed, setAreaCalcDismissed] = useState(false);
  const [previousExports, setPreviousExports] = useState<FloorPlanExport[]>([]);
  const [exportsLoading, setExportsLoading] = useState(true);
  const [floorplannerResult, setFloorplannerResult] = useState<FloorplannerProvisionResult | null>(null);
  const [floorplannerLoading, setFloorplannerLoading] = useState(false);
  const [floorplannerError, setFloorplannerError] = useState<string | null>(null);
  const [drawingResult, setDrawingResult] = useState<FloorplannerDrawingResult | null>(null);
  const [drawingLoading, setDrawingLoading] = useState(false);
  const [drawingError, setDrawingError] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [fpSaved, setFpSaved] = useState(false);
  const [fpSaveCount, setFpSaveCount] = useState(0);
  const [exportStatus, setExportStatus] = useState<'idle' | 'pending' | 'done' | 'error'>('idle');
  const [exportImageUrl, setExportImageUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const fpEditorMounted = useRef(false);
  const exportPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [calc, exps] = await Promise.all([
          getLatestAreaCalculationApi(projectId),
          getProjectFloorPlanExportsApi(projectId),
        ]);

        if (!active) return;

        if (calc?.calculatedResults) {
          setAreaCalc(calc);
          const cr = calc.calculatedResults;
          const prefillArea = cr.net_alan ?? cr.net_area_calculated;
          const prefillFloors = cr.kat_adedi;
          setWizardState((state) => ({
            ...state,
            values: {
              ...state.values,
              ...(prefillArea != null ? { totalArea: Math.min(300, Math.max(40, Math.round(Number(prefillArea)))) } : {}),
              ...(prefillFloors != null ? { floorCount: Math.min(30, Math.max(1, Math.round(Number(prefillFloors)))) } : {}),
            },
          }));
        }

        setPreviousExports(exps);
      } catch {
        // Non-fatal
      } finally {
        if (active) setExportsLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const existing = document.getElementById('fp-embed-script');
    if (existing) {
      setScriptReady(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'fp-embed-script';
    script.src = 'https://floorplanner.com/embed.js';
    script.onload = () => setScriptReady(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if ((e.data as { type?: string })?.type === 'floorplanner:saved') {
        setFpSaved(true);
        setFpSaveCount((c) => c + 1);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    if (fpSaveCount === 0) return;

    const stopPolling = () => {
      if (exportPollRef.current) clearTimeout(exportPollRef.current);
      if (exportTimeoutRef.current) clearTimeout(exportTimeoutRef.current);
    };

    const poll = async (exportId: string) => {
      try {
        const result = await getFloorplannerExportApi(projectId, exportId);
        if (result.status === 'done') {
          stopPolling();
          setExportStatus('done');
          setExportImageUrl(result.url ?? null);
          // Refresh exports gallery
          getProjectFloorPlanExportsApi(projectId).then(setPreviousExports).catch(() => undefined);
        } else {
          exportPollRef.current = setTimeout(() => void poll(exportId), 2000);
        }
      } catch (e) {
        stopPolling();
        setExportStatus('error');
        setExportError(getErrorMessage(e, 'Export durumu alınamadı'));
      }
    };

    const run = async () => {
      stopPolling();
      setExportStatus('pending');
      setExportImageUrl(null);
      setExportError(null);
      try {
        const { id: exportId } = await startFloorplannerExportApi(projectId);
        void poll(exportId);
        exportTimeoutRef.current = setTimeout(() => {
          stopPolling();
          setExportStatus('error');
          setExportError('Export zaman aşımına uğradı (30s)');
        }, 30000);
      } catch (e) {
        setExportStatus('error');
        setExportError(getErrorMessage(e, 'Export başlatılamadı'));
      }
    };

    void run();

    return () => {
      if (exportPollRef.current) clearTimeout(exportPollRef.current);
      if (exportTimeoutRef.current) clearTimeout(exportTimeoutRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fpSaveCount]);

  useEffect(() => {
    if (!floorplannerResult || !scriptReady || fpEditorMounted.current) return;
    const el = document.getElementById('fp-editor');
    if (!el) return;
    fpEditorMounted.current = true;
    window.initFPEditor?.({
      mountSelector: '#fp-editor',
      projectId: parseInt(floorplannerResult.projectId, 10),
      autoSetup: true,
      user: {
        id: floorplannerResult.userId,
        auth_token: floorplannerResult.authToken,
        permissions: ['save', 'no-export'],
      },
      language: 'en-US',
    });
  }, [floorplannerResult, scriptReady]);

  const { currentStep, values } = wizardState;
  const canProceed = currentStep !== 3 || values.generationMethod !== null;
  const progress = ((currentStep + 1) / stepLabels.length) * 100;

  const selectedExtras = useMemo(
    () => extras.filter((extra) => values.extras.includes(extra.id)),
    [values.extras],
  );

  const updateValues = (nextValues: Partial<WizardValues>) => {
    setWizardState((state) => ({
      ...state,
      values: { ...state.values, ...nextValues },
    }));
  };

  const goNext = () => {
    if (!canProceed) {
      return;
    }

    setWizardState((state) => ({
      ...state,
      currentStep: Math.min(state.currentStep + 1, stepLabels.length - 1),
    }));
  };

  const goBack = () => {
    setWizardState((state) => ({
      ...state,
      currentStep: Math.max(state.currentStep - 1, 0),
    }));
  };

  useEffect(() => {
    return () => {
      if (exportPollRef.current) clearTimeout(exportPollRef.current);
      if (exportTimeoutRef.current) clearTimeout(exportTimeoutRef.current);
    };
  }, []);

  const resetWizard = () => {
    if (exportPollRef.current) clearTimeout(exportPollRef.current);
    if (exportTimeoutRef.current) clearTimeout(exportTimeoutRef.current);
    setWizardState({ currentStep: 0, values: initialValues });
    setFloorplannerResult(null);
    setFloorplannerError(null);
    setDrawingResult(null);
    setDrawingError(null);
    setFpSaved(false);
    setFpSaveCount(0);
    setExportStatus('idle');
    setExportImageUrl(null);
    setExportError(null);
    fpEditorMounted.current = false;
  };

  const toggleExtra = (extraId: ExtraId) => {
    updateValues({
      extras: values.extras.includes(extraId)
        ? values.extras.filter((id) => id !== extraId)
        : [...values.extras, extraId],
    });
  };

  const handleProvisionFloorplanner = async () => {
    try {
      setFloorplannerLoading(true);
      setFloorplannerError(null);
      const result = await provisionFloorplannerProjectApi(projectId, {
        project: {
          name: `${propertyTypeLabels[values.propertyType]} ${values.totalArea} m²`,
          description: `${values.bedrooms} yatak odası, ${values.bathrooms} banyo, ${kitchenLabels[values.kitchenType]}`,
        },
      });
      setFloorplannerResult(result);
    } catch (error) {
      setFloorplannerError(getErrorMessage(error, 'Floorplanner projesi oluşturulamadı'));
    } finally {
      setFloorplannerLoading(false);
    }
  };

  const handleGenerateDrawing = async () => {
    try {
      setDrawingLoading(true);
      setDrawingError(null);
      const result = await generateFloorplannerDrawingApi(projectId, {
        bedroomCount: values.bedrooms,
        area: values.totalArea,
        kitchenType: values.kitchenType,
        extras: values.extras,
        bathroomCount: values.bathrooms,
        propertyType: values.propertyType,
        floorCount: values.floorCount,
      });
      setDrawingResult(result);
    } catch (error) {
      setDrawingError(getErrorMessage(error, 'AI kat planı Floorplanner’a gönderilemedi'));
    } finally {
      setDrawingLoading(false);
    }
  };

  const renderPropertyStep = () => {
    const cr = areaCalc?.calculatedResults;
    const showAlert = Boolean(cr) && !areaCalcDismissed;

    return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Box>
        <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>Mülk bilgileri</Typography>
        <Typography sx={{ color: '#6B7280', fontSize: 14 }}>Tip, alan ve kat sayısını belirleyin.</Typography>
      </Box>

      {showAlert && cr && (
        <Alert
          severity="info"
          onClose={() => setAreaCalcDismissed(true)}
          sx={{ '& .MuiAlert-message': { width: '100%' } }}
        >
          <Typography sx={{ fontWeight: 700, mb: 1, fontSize: 13 }}>
            Alan hesabından otomatik dolduruldu
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.75}>
            {cr.net_alan != null && (
              <Chip label={`Net Alan: ${Number(cr.net_alan).toFixed(0)} m²`} size="small" color="info" />
            )}
            {cr.on_bahce != null && (
              <Chip label={`Ön Bahçe: ${cr.on_bahce} m`} size="small" />
            )}
            {cr.yan_bahce != null && (
              <Chip label={`Yan Bahçe: ${cr.yan_bahce} m`} size="small" />
            )}
            {cr.arka_bahce != null && (
              <Chip label={`Arka Bahçe: ${cr.arka_bahce} m`} size="small" />
            )}
            {cr.kat_adedi != null && (
              <Chip label={`Kat Adedi: ${cr.kat_adedi}`} size="small" color="info" />
            )}
            {cr.insaat_nizami != null && (
              <Chip label={`Nizam: ${cr.insaat_nizami}`} size="small" />
            )}
          </Stack>
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 1.5 }}>
        {propertyTypes.map((type) => (
          <OptionTile
            key={type.value}
            selected={values.propertyType === type.value}
            icon={type.icon}
            title={type.label}
            caption={type.caption}
            onClick={() => updateValues({ propertyType: type.value })}
          />
        ))}
      </Box>

      <Box
        sx={{
          border: '1px solid #E5E7EB',
          borderRadius: 2,
          p: 2.5,
          bgcolor: '#FFFFFF',
          display: 'grid',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <SquareFootIcon sx={{ color: '#2563EB' }} />
            <Typography sx={{ fontWeight: 800, color: '#111827' }}>Toplam alan</Typography>
          </Box>
          <Typography sx={{ fontWeight: 900, color: '#111827', fontSize: 22 }}>{values.totalArea} m²</Typography>
        </Box>
        <Slider
          value={values.totalArea}
          min={40}
          max={300}
          step={5}
          marks={[
            { value: 40, label: '40' },
            { value: 170, label: '170' },
            { value: 300, label: '300' },
          ]}
          onChange={(_, value) => updateValues({ totalArea: Array.isArray(value) ? value[0] : value })}
          sx={{
            color: '#2563EB',
            '& .MuiSlider-thumb': { width: 20, height: 20 },
            '& .MuiSlider-markLabel': { color: '#6B7280', fontSize: 12 },
          }}
        />
      </Box>

      <CounterControl
        label="Kat sayısı"
        value={values.floorCount}
        min={1}
        max={30}
        icon={<LayersIcon />}
        onChange={(floorCount) => updateValues({ floorCount })}
      />
    </Box>
    );
  };

  const renderRoomsStep = () => (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Box>
        <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>Oda düzeni</Typography>
        <Typography sx={{ color: '#6B7280', fontSize: 14 }}>Yatak odası, banyo ve mutfak tipini ayarlayın.</Typography>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 1.5 }}>
        <CounterControl
          label="Yatak odası"
          value={values.bedrooms}
          min={1}
          max={6}
          icon={<KingBedIcon />}
          onChange={(bedrooms) => updateValues({ bedrooms })}
        />
        <CounterControl
          label="Banyo"
          value={values.bathrooms}
          min={1}
          max={4}
          icon={<BathtubIcon />}
          onChange={(bathrooms) => updateValues({ bathrooms })}
        />
      </Box>

      <Box
        sx={{
          border: '1px solid #E5E7EB',
          borderRadius: 2,
          p: 2.5,
          bgcolor: '#FFFFFF',
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        <Box>
          <Typography sx={{ fontWeight: 800, color: '#111827' }}>Mutfak tipi</Typography>
          <Typography sx={{ color: '#6B7280', fontSize: 13 }}>{kitchenLabels[values.kitchenType]}</Typography>
        </Box>
        <FormControlLabel
          control={
            <Switch
              checked={values.kitchenType === 'open'}
              onChange={(event) => updateValues({ kitchenType: event.target.checked ? 'open' : 'closed' })}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: '#059669' },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#059669' },
              }}
            />
          }
          label={values.kitchenType === 'open' ? 'Açık' : 'Kapalı'}
          sx={{ m: 0, '& .MuiFormControlLabel-label': { fontWeight: 800, color: '#111827' } }}
        />
      </Box>
    </Box>
  );

  const renderExtrasStep = () => (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Box>
        <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>Ek alanlar</Typography>
        <Typography sx={{ color: '#6B7280', fontSize: 14 }}>Planda yer almasını istediğiniz alanları seçin.</Typography>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 1.5 }}>
        {extras.map((extra) => {
          const selected = values.extras.includes(extra.id);

          return (
            <Box
              key={extra.id}
              component="button"
              type="button"
              onClick={() => toggleExtra(extra.id)}
              sx={{
                minHeight: 68,
                p: 1.5,
                borderRadius: 2,
                border: selected ? '2px solid #059669' : '1px solid #E5E7EB',
                bgcolor: selected ? '#ECFDF5' : '#FFFFFF',
                color: '#111827',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                textAlign: 'left',
                cursor: 'pointer',
                '&:hover': { borderColor: '#059669' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <InventoryIcon sx={{ color: selected ? '#047857' : '#6B7280' }} />
                <Typography sx={{ fontWeight: 800 }}>{extra.label}</Typography>
              </Box>
              <Checkbox checked={selected} tabIndex={-1} sx={{ p: 0, color: '#94A3B8', '&.Mui-checked': { color: '#059669' } }} />
            </Box>
          );
        })}
      </Box>
    </Box>
  );

  const renderMethodStep = () => (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Box>
        <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>Üretim yöntemi</Typography>
        <Typography sx={{ color: '#6B7280', fontSize: 14 }}>Sonuç ekranı seçtiğiniz yönteme göre hazırlanır.</Typography>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 1.5 }}>
        <OptionTile
          selected={values.generationMethod === 'ai'}
          icon={<AutoAwesomeIcon />}
          title="Option A: AI auto-generate"
          caption="Değerlerden otomatik kat planı taslağı üretir."
          onClick={() => updateValues({ generationMethod: 'ai' })}
        />
        <OptionTile
          selected={values.generationMethod === 'manual'}
          icon={<EditIcon />}
          title="Option B: manual editor"
          caption="Değerleri manuel düzenleyiciye aktarır."
          onClick={() => updateValues({ generationMethod: 'manual' })}
        />
      </Box>

      {!values.generationMethod && (
        <Box sx={{ border: '1px solid #F59E0B', bgcolor: '#FFFBEB', color: '#92400E', borderRadius: 2, p: 1.5, fontSize: 13, fontWeight: 700 }}>
          Devam etmek için bir üretim yöntemi seçin.
        </Box>
      )}
    </Box>
  );

  const renderAiResult = () => (
    <Box sx={{ display: 'grid', gap: 2.5 }}>
      <Box
        sx={{
          border: '1px solid #BFDBFE',
          bgcolor: '#EFF6FF',
          borderRadius: 2,
          p: 2.5,
          display: 'grid',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <AutoAwesomeIcon sx={{ color: '#2563EB' }} />
          <Box>
            <Typography sx={{ fontWeight: 900, color: '#111827' }}>AI taslak hazır</Typography>
            <Typography sx={{ color: '#475569', fontSize: 13 }}>Planda oda dengesi ve ek alanlar otomatik yerleştirildi.</Typography>
          </Box>
        </Box>
        <LinearProgress
          variant="determinate"
          value={100}
          sx={{ height: 8, borderRadius: 99, bgcolor: '#DBEAFE', '& .MuiLinearProgress-bar': { bgcolor: '#2563EB' } }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            disabled={drawingLoading}
            onClick={() => void handleGenerateDrawing()}
            sx={{
              bgcolor: '#2563EB',
              '&:hover': { bgcolor: '#1D4ED8' },
              '&.Mui-disabled': { bgcolor: '#CBD5E1', color: '#64748B' },
            }}
          >
            {drawingLoading ? <CircularProgress size={16} color="inherit" /> : 'AI planı Floorplanner’a gönder'}
          </Button>
          {drawingResult && (
            <Chip
              label={`${drawingResult.fml.walls.length} duvar, ${drawingResult.fml.labels.length} etiket`}
              size="small"
              sx={{ bgcolor: '#DBEAFE', color: '#1D4ED8', fontWeight: 800 }}
            />
          )}
        </Box>
        {drawingError && <Alert severity="error">{drawingError}</Alert>}
        {drawingResult && (
          <Alert severity="success">
            FML çizimi Floorplanner projesine gönderildi: {drawingResult.floorplannerProjectId}
          </Alert>
        )}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 1.5 }}>
        {[
          { label: 'Yerleşim verimi', value: '%92' },
          { label: 'Önerilen koridor', value: `${Math.max(8, Math.round(values.totalArea * 0.1))} m²` },
          { label: 'Ek alan', value: selectedExtras.length || 'Yok' },
        ].map((metric) => (
          <Box key={metric.label} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, p: 2, bgcolor: '#FFFFFF' }}>
            <Typography sx={{ color: '#6B7280', fontSize: 12 }}>{metric.label}</Typography>
            <Typography sx={{ color: '#111827', fontSize: 24, fontWeight: 900 }}>{metric.value}</Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ border: '1px solid #E5E7EB', borderRadius: 2, p: 2.5, bgcolor: '#FFFFFF' }}>
        <Typography sx={{ fontWeight: 900, color: '#111827', mb: 1 }}>Plan özeti</Typography>
        <SummaryChips values={values} />
      </Box>
    </Box>
  );

  const renderManualResult = () => (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '280px 1fr' }, gap: 2 }}>
      <Box sx={{ border: '1px solid #E5E7EB', borderRadius: 2, p: 2.5, bgcolor: '#FFFFFF', alignSelf: 'start' }}>
        <Typography sx={{ fontWeight: 900, color: '#111827', mb: 1 }}>Editör girdileri</Typography>
        <SummaryChips values={values} />
      </Box>

      <Box sx={{ border: '1px solid #CBD5E1', borderRadius: 2, bgcolor: '#FFFFFF', overflow: 'hidden' }}>
        <Box
          sx={{
            px: 2,
            py: 1.25,
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            bgcolor: '#F8FAFC',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EditIcon sx={{ color: '#475569', fontSize: 20 }} />
            <Typography sx={{ fontWeight: 900, color: '#111827' }}>Manual editor</Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            disabled={floorplannerLoading}
            onClick={() => void handleProvisionFloorplanner()}
            sx={{
              bgcolor: '#1F2937',
              '&:hover': { bgcolor: '#111827' },
              '&.Mui-disabled': { bgcolor: '#CBD5E1', color: '#64748B' },
            }}
          >
            {floorplannerLoading ? <CircularProgress size={16} color="inherit" /> : 'Floorplanner oluştur'}
          </Button>
        </Box>
        {(floorplannerError || floorplannerResult) && (
          <Box sx={{ p: 2, pb: 0 }}>
            {floorplannerError && <Alert severity="error">{floorplannerError}</Alert>}
            {fpSaved && <Alert severity="success">Floorplanner projesi kaydedildi.</Alert>}
          </Box>
        )}
        {floorplannerResult ? (
          <Box id="fp-editor" sx={{ minHeight: 500, width: '100%' }} />
        ) : (
          <Box
            sx={{
              minHeight: 310,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: '#F8FAFC',
              color: '#94A3B8',
            }}
          >
            <Typography sx={{ fontSize: 14 }}>Floorplanner editörünü başlatmak için yukarıdaki butona tıklayın.</Typography>
          </Box>
        )}
        {exportStatus !== 'idle' && (
          <Box sx={{ p: 2, borderTop: '1px solid #E5E7EB' }}>
            {exportStatus === 'pending' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <CircularProgress size={16} />
                <Typography sx={{ fontSize: 13, color: '#475569' }}>2D görsel dışa aktarılıyor…</Typography>
              </Box>
            )}
            {exportStatus === 'error' && <Alert severity="error">{exportError}</Alert>}
            {exportStatus === 'done' && exportImageUrl && (
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>2D Kat Planı</Typography>
                <Box
                  component="img"
                  src={exportImageUrl}
                  alt="2D kat planı"
                  sx={{ width: '100%', borderRadius: 1, border: '1px solid #E5E7EB' }}
                />
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );

  const renderResultStep = () => (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Box>
        <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>Sonuç</Typography>
        <Typography sx={{ color: '#6B7280', fontSize: 14 }}>
          {values.generationMethod === 'ai' ? 'AI üretim akışı seçildi.' : 'Manuel düzenleyici akışı seçildi.'}
        </Typography>
      </Box>
      {values.generationMethod === 'ai' ? renderAiResult() : renderManualResult()}
    </Box>
  );

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#111827', mb: 0.5 }}>
          Kat Planı Sihirbazı
        </Typography>
        <Typography sx={{ color: '#6B7280', fontSize: 14 }}>
          Mülk değerlerini adım adım girin ve üretim akışını seçin.
        </Typography>
      </Box>

      {(exportsLoading || previousExports.length > 0) && (
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#111827', mb: 1.5 }}>
            Önceki Kat Planları
          </Typography>
          {exportsLoading ? (
            <Box sx={{ display: 'flex', gap: 2 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} variant="rectangular" width={180} height={200} sx={{ borderRadius: 2, flexShrink: 0 }} />
              ))}
            </Box>
          ) : (
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                overflowX: 'auto',
                pb: 1,
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' },
              }}
            >
              {previousExports.map((exp) => (
                <Box
                  key={exp.id}
                  sx={{
                    width: 180,
                    minWidth: 180,
                    border: '1px solid #E5E7EB',
                    borderRadius: 2,
                    overflow: 'hidden',
                    bgcolor: '#FFFFFF',
                    flexShrink: 0,
                  }}
                >
                  <Box
                    component="img"
                    src={exp.imageUrl}
                    alt="Kat planı"
                    sx={{ width: '100%', height: 120, objectFit: 'cover', display: 'block', bgcolor: '#F1F5F9' }}
                  />
                  <Box sx={{ p: 1.25 }}>
                    <Typography sx={{ fontSize: 11, color: '#94A3B8', mb: 1 }}>
                      {new Date(exp.createdAt).toLocaleDateString('tr-TR')}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.75 }}>
                      <Button
                        size="small"
                        startIcon={<OpenInNewIcon sx={{ fontSize: 13 }} />}
                        href={exp.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ fontSize: 11, px: 1, py: 0.5, minWidth: 0, color: '#475569', flexShrink: 0 }}
                      >
                        Görüntüle
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<ViewInArIcon sx={{ fontSize: 13 }} />}
                        onClick={() => router.push(`/workspace/projects/${projectId}/3d-model?fromFloorPlan=${exp.id}`)}
                        sx={{
                          fontSize: 11,
                          px: 1,
                          py: 0.5,
                          minWidth: 0,
                          bgcolor: '#2D6A4F',
                          '&:hover': { bgcolor: '#52B788' },
                          flexShrink: 0,
                        }}
                      >
                        3D'ye Gönder
                      </Button>
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}

      <Box
        sx={{
          border: '1px solid #E5E7EB',
          borderRadius: 2,
          bgcolor: '#FFFFFF',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ p: { xs: 2, md: 3 }, borderBottom: '1px solid #E5E7EB' }}>
          <Stepper
            activeStep={currentStep}
            alternativeLabel
            sx={{
              '& .MuiStepLabel-label': { fontSize: { xs: 11, sm: 13 }, mt: 0.75 },
              '& .MuiStepIcon-root.Mui-active': { color: '#2563EB' },
              '& .MuiStepIcon-root.Mui-completed': { color: '#059669' },
              '& .MuiStepLabel-label.Mui-active': { fontWeight: 900 },
            }}
          >
            {stepLabels.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ mt: 2.5, height: 6, borderRadius: 99, bgcolor: '#F1F5F9', '& .MuiLinearProgress-bar': { bgcolor: '#2563EB' } }}
          />
        </Box>

        <Box sx={{ p: { xs: 2, md: 3 }, minHeight: 430 }}>
          {currentStep === 0 && renderPropertyStep()}
          {currentStep === 1 && renderRoomsStep()}
          {currentStep === 2 && renderExtrasStep()}
          {currentStep === 3 && renderMethodStep()}
          {currentStep === 4 && renderResultStep()}
        </Box>

        <Divider />

        <Box
          sx={{
            p: { xs: 2, md: 3 },
            display: 'flex',
            justifyContent: 'space-between',
            gap: 1.5,
            flexWrap: 'wrap',
          }}
        >
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            disabled={currentStep === 0}
            onClick={goBack}
            sx={{ minWidth: 118 }}
          >
            Geri
          </Button>

          <Box sx={{ display: 'flex', gap: 1.25, ml: 'auto' }}>
            {currentStep === stepLabels.length - 1 && (
              <Button variant="outlined" startIcon={<RestartAltIcon />} onClick={resetWizard}>
                Sıfırla
              </Button>
            )}
            {currentStep < stepLabels.length - 1 && (
              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                disabled={!canProceed}
                onClick={goNext}
                sx={{
                  minWidth: 128,
                  bgcolor: '#1F2937',
                  '&:hover': { bgcolor: '#111827' },
                  '&.Mui-disabled': { bgcolor: '#CBD5E1', color: '#64748B' },
                }}
              >
                İleri
              </Button>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
