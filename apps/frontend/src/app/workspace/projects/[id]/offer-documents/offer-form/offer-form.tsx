'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import dynamic from 'next/dynamic';
import type {
  BasementFloor,
  OfferBuilding,
  OfferDocument,
  OfferDocumentPayload,
  OfferUnit,
  StreetLabels,
  UnitType,
} from '@/services/offer-documents/types';
import { BuildingPreview } from './building-preview';
import {
  calculateUnitM2,
  DEFAULT_PAGE2_HTML,
  defaultBuilding,
  emptyStreetLabels,
  makeUnit,
} from './building-utils';

const RichTextEditor = dynamic(
  () => import('./RichTextEditor').then((m) => ({ default: m.RichTextEditor })),
  { ssr: false },
);

const steps = ['Genel Bilgiler', 'Teklif İçeriği', 'Bina Yapısı', 'Önizleme'];

interface OfferFormProps {
  initialDocument: OfferDocument | null;
  parcelArea: number | null;
  companyName: string;
  onCancel: () => void;
  onSave: (payload: OfferDocumentPayload, id?: string) => Promise<OfferDocument>;
  onGeneratePdf: (id: string) => Promise<void>;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function cloneUnits(units: OfferUnit[]): OfferUnit[] {
  return units.map((unit) => ({ ...unit }));
}

function buildPayloadFromDocument(
  document: OfferDocument | null,
  parcelArea: number | null,
  companyName: string,
): OfferDocumentPayload {
  return document
    ? {
      parcelTitle: document.parcelTitle,
      offerDate: document.offerDate,
      page2Content: document.page2Content,
      tcmbRate: document.tcmbRate,
      companyName: document.companyName,
      building: document.building,
    }
    : {
      parcelTitle: '',
      offerDate: today(),
      page2Content: DEFAULT_PAGE2_HTML,
      tcmbRate: '1 Dolar (USD): 45,45 TL',
      companyName,
      building: defaultBuilding(parcelArea ?? 0),
    };
}


export function OfferForm({
  initialDocument,
  parcelArea,
  companyName,
  onCancel,
  onSave,
  onGeneratePdf,
}: OfferFormProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [payload, setPayload] = useState<OfferDocumentPayload>(() => buildPayloadFromDocument(initialDocument, parcelArea, companyName));
  const [savedDocument, setSavedDocument] = useState<OfferDocument | null>(initialDocument);
  const [parcelAreaOverride, setParcelAreaOverride] = useState(false);
  const [manualParcelArea, setManualParcelArea] = useState<string>(String(parcelArea ?? 0));
  const [normalFloorsSame, setNormalFloorsSame] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPayload(buildPayloadFromDocument(initialDocument, parcelArea, companyName));
    setSavedDocument(initialDocument);
    setManualParcelArea(String(parcelArea ?? 0));
    setActiveStep(0);
  }, [initialDocument, parcelArea, companyName]);

  const tabanAlani = parcelAreaOverride
    ? (parseFloat(manualParcelArea) || 0)
    : (parcelArea ?? (parseFloat(manualParcelArea) || 0));

  const canSave = payload.parcelTitle.trim() && payload.offerDate && payload.page2Content.trim();

  const updateBuilding = (updater: (building: OfferBuilding) => OfferBuilding) => {
    setPayload((current) => ({ ...current, building: updater(current.building) }));
  };

  // ── Basement floors ────────────────────────────────────────────────────────

  const addBasementFloor = () => {
    updateBuilding((building) => {
      const idx = building.basementFloors.length;
      const m2 = calculateUnitM2(tabanAlani, building.staircaseDeduction, 2);
      const newFloor: BasementFloor = {
        label: `${idx + 1}. BODRUM KAT`,
        isCommonArea: true,
        commonAreaM2: tabanAlani || null,
        commonAreaLabel: 'ORTAK ALAN',
        units: [makeUnit(1, m2, undefined, 'depo'), makeUnit(2, m2, undefined, 'depo')],
        streetLabels: emptyStreetLabels,
      };
      return { ...building, basementFloors: [...building.basementFloors, newFloor] };
    });
  };

  const removeBasementFloor = (index: number) => {
    updateBuilding((building) => ({
      ...building,
      basementFloors: building.basementFloors.filter((_, i) => i !== index),
    }));
  };

  // ── Normal floors ──────────────────────────────────────────────────────────

  const addNormalFloor = () => {
    updateBuilding((building) => {
      const idx = building.normalFloors.length;
      const templateUnits = building.normalFloors[0]?.units ?? [makeUnit(1), makeUnit(2)];
      const newFloor = { floorNumber: idx + 1, units: cloneUnits(templateUnits) };
      return { ...building, normalFloors: [...building.normalFloors, newFloor] };
    });
  };

  const removeNormalFloor = (index: number) => {
    updateBuilding((building) => ({
      ...building,
      normalFloors: building.normalFloors
        .filter((_, i) => i !== index)
        .map((f, i) => ({ ...f, floorNumber: i + 1 })),
    }));
  };

  const applySameNormalFloors = (checked: boolean) => {
    setNormalFloorsSame(checked);
    if (!checked) return;
    updateBuilding((building) => {
      const templateUnits = building.normalFloors[0]?.units ?? [];
      return {
        ...building,
        normalFloors: building.normalFloors.map((floor) => ({
          floorNumber: floor.floorNumber,
          units: cloneUnits(templateUnits),
        })),
      };
    });
  };

  const applyToAllNormalFloors = (
    unitIndex: number,
    field: 'brutM2' | 'paymentAmount',
    value: number | null,
  ) => {
    updateBuilding((building) => ({
      ...building,
      normalFloors: building.normalFloors.map((floor) => ({
        ...floor,
        units: floor.units.map((u, i) =>
          i === unitIndex
            ? { ...u, [field]: value, ...(field === 'brutM2' ? { manualM2Override: true } : {}) }
            : u,
        ),
      })),
    }));
  };

  const save = async (): Promise<OfferDocument | null> => {
    if (!canSave) {
      setError('Parsel başlığı, teklif tarihi ve teklif içeriği zorunludur.');
      return null;
    }
    try {
      setIsSaving(true);
      setError(null);
      const saved = await onSave(payload, savedDocument?.id);
      setSavedDocument(saved);
      return saved;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Teklif kaydedilemedi');
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleGeneratePdf = async () => {
    const saved = savedDocument ?? await save();
    if (!saved) return;
    await onGeneratePdf(saved.id);
  };

  const previewBuilding = useMemo(() => payload.building, [payload.building]);

  return (
    <Stack spacing={3}>
      <Stepper activeStep={activeStep} alternativeLabel>
        {steps.map((step) => (
          <Step key={step}><StepLabel>{step}</StepLabel></Step>
        ))}
      </Stepper>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {/* ── Step 0: Genel Bilgiler ── */}
      {activeStep === 0 ? (
        <Stack spacing={2}>
          <TextField
            label="Parsel başlığı"
            value={payload.parcelTitle}
            onChange={(e) => setPayload((c) => ({ ...c, parcelTitle: e.target.value }))}
            fullWidth
          />
          <TextField
            label="Teklif tarihi"
            type="date"
            value={payload.offerDate}
            onChange={(e) => setPayload((c) => ({ ...c, offerDate: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="TCMB dolar kuru"
            value={payload.tcmbRate}
            onChange={(e) => setPayload((c) => ({ ...c, tcmbRate: e.target.value }))}
            fullWidth
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField
              label="Taban oturum alanı"
              value={parcelAreaOverride ? manualParcelArea : (tabanAlani === 0 ? '' : String(tabanAlani))}
              disabled={!parcelAreaOverride}
              onChange={(e) => setManualParcelArea(e.target.value)}
              onBlur={(e) => {
                const parsed = parseFloat(e.target.value);
                if (!Number.isNaN(parsed)) setManualParcelArea(String(parsed));
              }}
              helperText={parcelArea == null ? 'Kayıtlı taban oturum alanı bulunamadı' : 'Son hesaplamadan otomatik alındı'}
              inputProps={{ inputMode: 'decimal' }}
            />
            <TextField
              label="Merdiven/asansör payı"
              value={payload.building.staircaseDeduction === 0 ? '' : String(payload.building.staircaseDeduction)}
              onChange={(e) => {
                const raw = e.target.value;
                setPayload((c) => ({ ...c, building: { ...c.building, staircaseDeduction: parseFloat(raw) || 0 } }));
              }}
              onBlur={(e) => {
                const parsed = Math.max(0, parseFloat(e.target.value) || 0);
                setPayload((c) => ({ ...c, building: { ...c.building, staircaseDeduction: parsed } }));
              }}
              inputProps={{ inputMode: 'decimal' }}
            />
          </Box>
          <FormControlLabel
            control={<Checkbox checked={parcelAreaOverride} onChange={(e) => setParcelAreaOverride(e.target.checked)} />}
            label="Taban oturum alanını elle değiştir"
          />
        </Stack>
      ) : null}

      {/* ── Step 1: Teklif İçeriği ── */}
      {activeStep === 1 ? (
        <Stack spacing={1}>
          <RichTextEditor
            key={savedDocument?.id ?? 'new'}
            initialValue={payload.page2Content}
            onChange={(html) => setPayload((c) => ({ ...c, page2Content: html }))}
          />
        </Stack>
      ) : null}

      {/* ── Step 2: Bina Yapısı ── */}
      {activeStep === 2 ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 7fr) minmax(420px, 5fr)' }, gap: 3, alignItems: 'start' }}>
          <Stack spacing={2}>

            {/* Bodrum katlar */}
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Bodrum Katlar</Typography>
            {payload.building.basementFloors.map((floor, index) => (
              <BasementFloorEditor
                key={index}
                floor={floor}
                index={index}
                tabanAlani={tabanAlani}
                staircaseDeduction={payload.building.staircaseDeduction}
                canRemove={payload.building.basementFloors.length > 1}
                allFloors={payload.building}
                companyName={companyName}
                onRemove={() => removeBasementFloor(index)}
                onChange={(nextFloor) => updateBuilding((building) => {
                  const basementFloors = [...building.basementFloors];
                  basementFloors[index] = nextFloor;
                  return { ...building, basementFloors };
                })}
              />
            ))}
            <Box>
              <Button startIcon={<AddIcon />} onClick={addBasementFloor} variant="outlined" size="small">
                Bodrum Kat Ekle
              </Button>
            </Box>

            <Divider />

            {/* Zemin kat */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Switch
                checked={payload.building.groundFloor.exists}
                onChange={(e) => updateBuilding((b) => ({ ...b, groundFloor: { ...b.groundFloor, exists: e.target.checked } }))}
              />
              <Typography sx={{ fontWeight: 600 }}>Zemin Kat</Typography>
            </Box>
            {payload.building.groundFloor.exists ? (
              <>
                <UnitsEditor
                  title="Zemin Kat"
                  units={payload.building.groundFloor.units}
                  tabanAlani={tabanAlani}
                  staircaseDeduction={payload.building.staircaseDeduction}
                  allFloors={payload.building}
                  companyName={companyName}
                  onChange={(units) => updateBuilding((b) => ({ ...b, groundFloor: { ...b.groundFloor, units } }))}
                />
                <StreetLabelsEditor
                  labels={payload.building.groundFloor.streetLabels}
                  onChange={(streetLabels) => updateBuilding((b) => ({ ...b, groundFloor: { ...b.groundFloor, streetLabels } }))}
                />
              </>
            ) : null}

            <Divider />

            {/* Normal katlar */}
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Normal Katlar</Typography>
            <FormControlLabel
              control={<Checkbox checked={normalFloorsSame} onChange={(e) => applySameNormalFloors(e.target.checked)} />}
              label="Tüm normal katlar aynı mı?"
            />
            {normalFloorsSame && payload.building.normalFloors.length > 1 ? (
              <Alert severity="info" sx={{ py: 0.5, fontSize: 13 }}>
                Tüm katlar senkronize — bir kattaki değişiklik diğer katlara yansır
              </Alert>
            ) : null}
            {payload.building.normalFloors.length === 0 ? (
              <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>Henüz normal kat eklenmedi.</Typography>
            ) : null}
            {payload.building.normalFloors.map((floor, index) => (
              <Box key={floor.floorNumber}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{floor.floorNumber}. Normal Kat</Typography>
                    {normalFloorsSame && payload.building.normalFloors.length > 1 ? (
                      <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1 }}>🔄</Typography>
                    ) : null}
                  </Box>
                  <Tooltip title="Katı kaldır">
                    <IconButton size="small" color="error" onClick={() => removeNormalFloor(index)}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <UnitsEditor
                  title={`${floor.floorNumber}. Normal Kat`}
                  units={floor.units}
                  tabanAlani={tabanAlani}
                  staircaseDeduction={payload.building.staircaseDeduction}
                  allFloors={payload.building}
                  onApplyToAllFloors={applyToAllNormalFloors}
                  companyName={companyName}
                  onChange={(units) => updateBuilding((building) => {
                    const normalFloors = normalFloorsSame
                      ? building.normalFloors.map((item) => ({ ...item, units: cloneUnits(units) }))
                      : building.normalFloors.map((item) => (item.floorNumber === floor.floorNumber ? { ...item, units } : item));
                    return { ...building, normalFloors };
                  })}
                />
              </Box>
            ))}
            <Box>
              <Button startIcon={<AddIcon />} onClick={addNormalFloor} variant="outlined" size="small">
                Normal Kat Ekle
              </Button>
            </Box>

            <Divider />

            {/* Çatı katı */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Switch
                checked={payload.building.roofFloor.exists}
                onChange={(e) => updateBuilding((b) => ({ ...b, roofFloor: { ...b.roofFloor, exists: e.target.checked } }))}
              />
              <Typography sx={{ fontWeight: 600 }}>Çatı Katı</Typography>
            </Box>
            {payload.building.roofFloor.exists ? (
              <UnitsEditor
                title="Çatı Katı"
                units={payload.building.roofFloor.units}
                tabanAlani={tabanAlani}
                staircaseDeduction={payload.building.staircaseDeduction}
                allFloors={payload.building}
                companyName={companyName}
                onChange={(units) => updateBuilding((b) => ({ ...b, roofFloor: { ...b.roofFloor, units } }))}
              />
            ) : null}
          </Stack>

          <BuildingPreview parcelTitle={payload.parcelTitle} building={previewBuilding} />
        </Box>
      ) : null}

      {/* ── Step 3: Önizleme ── */}
      {activeStep === 3 ? (
        <Stack spacing={2}>
          <Alert severity="info">Teklif kaydedildikten sonra PDF oluşturulur. Eksik statik sayfa dosyası varsa PDF yalnızca ilk 3 sayfa olarak üretilecektir.</Alert>
          <BuildingPreview parcelTitle={payload.parcelTitle} building={payload.building} />
          <Button variant="contained" onClick={() => void handleGeneratePdf()} disabled={isSaving}>
            PDF Oluştur
          </Button>
        </Stack>
      ) : null}

      {/* Navigation */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, pt: 1 }}>
        <Button
          variant="outlined"
          startIcon={activeStep === 0 ? undefined : <ArrowBackIcon />}
          onClick={activeStep === 0 ? onCancel : () => setActiveStep((s) => s - 1)}
        >
          {activeStep === 0 ? 'Vazgeç' : 'Geri'}
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" onClick={() => void save()} disabled={isSaving || !canSave}>
            Kaydet
          </Button>
          {activeStep < steps.length - 1 ? (
            <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={() => setActiveStep((s) => s + 1)}>
              İleri
            </Button>
          ) : null}
        </Box>
      </Box>
    </Stack>
  );
}

// ── BasementFloorEditor ──────────────────────────────────────────────────────

function BasementFloorEditor({
  floor,
  index,
  tabanAlani,
  staircaseDeduction,
  canRemove,
  allFloors,
  companyName,
  onRemove,
  onChange,
}: {
  floor: BasementFloor;
  index: number;
  tabanAlani: number;
  staircaseDeduction: number;
  canRemove: boolean;
  allFloors: OfferBuilding;
  companyName: string;
  onRemove: () => void;
  onChange: (floor: BasementFloor) => void;
}) {
  return (
    <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 1, p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{floor.label}</Typography>
        {canRemove ? (
          <Tooltip title="Bodrum katı kaldır">
            <IconButton size="small" color="error" onClick={onRemove}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null}
      </Box>
      <Stack spacing={2}>
        <TextField size="small" label="Kat etiketi" value={floor.label} onChange={(e) => onChange({ ...floor, label: e.target.value })} fullWidth />
        <FormControlLabel
          control={<Switch checked={floor.isCommonArea} onChange={(e) => onChange({ ...floor, isCommonArea: e.target.checked })} />}
          label="Ortak Alan"
        />
        {floor.isCommonArea ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField
              label="Alan m²"
              size="small"
              value={floor.commonAreaM2 ?? ''}
              onChange={(e) => onChange({ ...floor, commonAreaM2: e.target.value === '' ? null : (parseFloat(e.target.value) || 0) })}
              onBlur={(e) => {
                if (e.target.value !== '') {
                  onChange({ ...floor, commonAreaM2: Math.max(0, parseFloat(e.target.value) || 0) });
                }
              }}
              inputProps={{ inputMode: 'decimal' }}
            />
            <TextField size="small" label="Alan etiketi" value={floor.commonAreaLabel ?? ''} onChange={(e) => onChange({ ...floor, commonAreaLabel: e.target.value })} />
          </Box>
        ) : (
          <UnitsEditor
            title={`${index + 1}. Bodrum Kat Birimleri`}
            units={floor.units}
            tabanAlani={tabanAlani}
            staircaseDeduction={staircaseDeduction}
            allFloors={allFloors}
            linkedUnitScope="groundOnly"
            isBasement
            companyName={companyName}
            onChange={(units) => onChange({ ...floor, units })}
          />
        )}
        <StreetLabelsEditor labels={floor.streetLabels} onChange={(streetLabels) => onChange({ ...floor, streetLabels })} />
      </Stack>
    </Box>
  );
}

// ── StreetLabelsEditor ───────────────────────────────────────────────────────

function StreetLabelsEditor({ labels, onChange }: { labels: StreetLabels; onChange: (labels: StreetLabels) => void }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1 }}>
      <TextField size="small" label="Sol sokak" value={labels.left ?? ''} onChange={(e) => onChange({ ...labels, left: e.target.value || null })} />
      <TextField size="small" label="Sağ sokak" value={labels.right ?? ''} onChange={(e) => onChange({ ...labels, right: e.target.value || null })} />
      <TextField size="small" label="Alt sokak" value={labels.bottom ?? ''} onChange={(e) => onChange({ ...labels, bottom: e.target.value || null })} />
    </Box>
  );
}

// ── Helper: collect units for linkedUnit dropdown ────────────────────────────

interface UnitRef {
  id: number;
  unitId: number;
  label: string;       // shown in the dropdown
  linkLabel?: string;  // stored as linkedUnitLabel on the unit
}

function collectAllUnits(building: OfferBuilding): UnitRef[] {
  const refs: UnitRef[] = [];
  building.basementFloors.forEach((floor) => {
    if (!floor.isCommonArea) {
      floor.units.forEach((u) => {
        refs.push({ id: u.id, unitId: u.id, label: `${floor.label} - ${u.label ?? `Birim ${u.id}`}` });
      });
    }
  });
  if (building.groundFloor.exists) {
    building.groundFloor.units.forEach((u) => {
      const num = u.unitNumber ?? u.id;
      refs.push({
        id: u.id,
        unitId: u.id,
        label: `Zemin Kat - Daire #${num} (${u.ownerName})`,
        linkLabel: `Zemin Kat Daire ${num}'e ait`,
      });
    });
  }
  return refs;
}

function collectGroundFloorUnits(building: OfferBuilding): UnitRef[] {
  if (!building.groundFloor.exists) return [];
  return building.groundFloor.units.map((u) => {
    const num = u.unitNumber ?? u.id;
    return {
      id: u.id,
      unitId: u.id,
      label: `Zemin Kat - Daire #${num} (${u.ownerName})`,
      linkLabel: `Zemin Kat Daire ${num}'e ait`,
    };
  });
}

// ── UnitsEditor ──────────────────────────────────────────────────────────────

function UnitsEditor({
  title,
  units,
  tabanAlani,
  staircaseDeduction,
  allFloors,
  onApplyToAllFloors,
  linkedUnitScope,
  isBasement,
  companyName,
  onChange,
}: {
  title: string;
  units: OfferUnit[];
  tabanAlani: number;
  staircaseDeduction: number;
  allFloors: OfferBuilding;
  onApplyToAllFloors?: (unitIndex: number, field: 'brutM2' | 'paymentAmount', value: number | null) => void;
  linkedUnitScope?: 'groundOnly';
  isBasement?: boolean;
  companyName: string;
  onChange: (units: OfferUnit[]) => void;
}) {
  const [mergingIdx, setMergingIdx] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ unitIndex: number; field: string } | null>(null);

  const autoM2 = calculateUnitM2(tabanAlani, staircaseDeduction, Math.max(1, units.length));
  const linkedRefs = linkedUnitScope === 'groundOnly'
    ? collectGroundFloorUnits(allFloors)
    : collectAllUnits(allFloors);

  const updateUnit = (index: number, patch: Partial<OfferUnit>) => {
    onChange(units.map((unit, i) => (i === index ? { ...unit, ...patch } : unit)));
  };

  const addUnit = () => {
    const defaultUnitType: UnitType = isBasement ? 'depo' : 'daire';
    const newUnit = makeUnit(units.length + 1, autoM2, undefined, defaultUnitType);
    const recalc = [...units, newUnit].map((u) =>
      u.manualM2Override ? u : { ...u, brutM2: calculateUnitM2(tabanAlani, staircaseDeduction, units.length + 1) },
    );
    onChange(recalc);
  };

  const removeUnit = (index: number) => {
    if (units.length <= 1) return;
    const next = units.filter((_, i) => i !== index);
    const recalcM2 = calculateUnitM2(tabanAlani, staircaseDeduction, Math.max(1, next.length));
    onChange(next.map((u) => u.manualM2Override ? u : { ...u, brutM2: recalcM2 }));
  };

  const mergeUnits = (primaryIdx: number, secondaryId: number) => {
    const primary = units[primaryIdx];
    const secondary = units.find((u) => u.id === secondaryId);
    if (!secondary) return;
    const combinedM2 = primary.manualM2Override
      ? primary.brutM2
      : primary.brutM2 + secondary.brutM2;
    onChange(units.map((u, i) => {
      if (i === primaryIdx) return { ...u, mergedWithIds: [...(u.mergedWithIds ?? []), secondaryId], brutM2: combinedM2 };
      if (u.id === secondaryId) return { ...u, isMergedInto: primary.id };
      return u;
    }));
    setMergingIdx(null);
  };

  const unmergeUnit = (primaryIdx: number) => {
    const mergedIds = units[primaryIdx].mergedWithIds ?? [];
    onChange(units.map((u, i) => {
      if (i === primaryIdx) return { ...u, mergedWithIds: [] };
      if (mergedIds.includes(u.id)) return { ...u, isMergedInto: null };
      return u;
    }));
  };

  const getMergeTargets = (primaryIdx: number): OfferUnit[] => {
    const primary = units[primaryIdx];
    const alreadyMerged = primary.mergedWithIds ?? [];
    return units.filter((u, i) =>
      i !== primaryIdx && !u.isMergedInto && !alreadyMerged.includes(u.id),
    );
  };

  return (
    <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 1, p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.5 }}>
        <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={addUnit}>Birim Ekle</Button>
      </Box>
      <Stack spacing={1.5}>
        {units.map((unit, index) => {
          // Secondary (absorbed) unit — show collapsed indicator
          if (unit.isMergedInto != null) {
            return (
              <Box
                key={index}
                sx={{ p: 1, bgcolor: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 1, opacity: 0.65 }}
              >
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  Birim #{unit.id} ({unit.ownerName}) — #{unit.isMergedInto} ile birleştirildi
                </Typography>
              </Box>
            );
          }

          const isPrimary = (unit.mergedWithIds?.length ?? 0) > 0;
          const mergeTargets = getMergeTargets(index);

          if (isBasement) {
            // ── Basement unit row ──────────────────────────────────────────────
            const unitType = unit.unitType ?? 'depo';
            const showOwner = unitType === 'depo' || unitType === 'diger';
            const showPayment = unitType === 'diger';
            const showLinked = unitType === 'depo' || unitType === 'diger';

            const handleUnitTypeChange = (newType: UnitType) => {
              const isNullOwnerType = newType === 'ortak_alan' || newType === 'siginak';
              const newOwnerType = isNullOwnerType ? null : (unit.ownerType === null ? 'tapu' : unit.ownerType);
              const nameMap: Partial<Record<UnitType, string>> = {
                depo: 'DEPO',
                siginak: 'SIĞINAK',
                ortak_alan: 'ORTAK ALAN',
                diger: '',
              };
              const patch: Partial<OfferUnit> = {
                unitType: newType,
                ownerType: newOwnerType,
                ownerName: nameMap[newType] ?? unit.ownerName,
              };
              if (isNullOwnerType) {
                patch.paymentAmount = null;
                patch.linkedUnitId = null;
                patch.linkedUnitLabel = null;
              }
              if (newType === 'depo') patch.paymentAmount = null;
              updateUnit(index, patch);
            };

            return (
              <Box key={index}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'start' }}>
                  {/* Birim Tipi */}
                  <TextField
                    size="small"
                    select
                    label="Birim Tipi"
                    value={unitType}
                    onChange={(e) => handleUnitTypeChange(e.target.value as UnitType)}
                    sx={{ width: 130 }}
                  >
                    <MenuItem value="depo">Depo</MenuItem>
                    <MenuItem value="siginak">Sığınak</MenuItem>
                    <MenuItem value="ortak_alan">Ortak Alan</MenuItem>
                    <MenuItem value="diger">Diğer</MenuItem>
                  </TextField>

                  {/* Sahip (depo / diger only) */}
                  {showOwner ? (
                    <TextField
                      size="small"
                      select
                      label="Sahip"
                      value={unit.ownerType ?? 'tapu'}
                      onChange={(e) => updateUnit(index, { ownerType: e.target.value as 'mila' | 'tapu' })}
                      sx={{ width: 140 }}
                    >
                      <MenuItem value="mila">{companyName}</MenuItem>
                      <MenuItem value="tapu">Tapu Sahibi</MenuItem>
                    </TextField>
                  ) : null}

                  {/* İsim */}
                  <TextField
                    size="small"
                    label="İsim"
                    value={unit.ownerName}
                    onChange={(e) => updateUnit(index, { ownerName: e.target.value })}
                    sx={{ flex: 1, minWidth: 100 }}
                  />

                  {/* Brüt m² */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    <TextField
                      size="small"
                      label="Brüt m²"
                      value={unit.brutM2 === 0 && !unit.manualM2Override ? String(autoM2) : String(unit.brutM2)}
                      onChange={(e) => updateUnit(index, { brutM2: parseFloat(e.target.value) || 0, manualM2Override: true })}
                      onBlur={(e) => {
                        const parsed = Math.max(0, parseFloat(e.target.value) || 0);
                        updateUnit(index, { brutM2: parsed, manualM2Override: true });
                      }}
                      inputProps={{ inputMode: 'decimal' }}
                      sx={{ width: 90 }}
                    />
                  </Box>

                  {/* Bağlı Birim (depo / diger) */}
                  {showLinked ? (
                    <TextField
                      size="small"
                      select
                      label="Bağlı Birim"
                      value={unit.linkedUnitId ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          updateUnit(index, { linkedUnitId: null, linkedUnitLabel: null });
                        } else {
                          const ref = linkedRefs.find((r) => r.unitId === Number(val));
                          updateUnit(index, {
                            linkedUnitId: Number(val),
                            linkedUnitLabel: ref ? (ref.linkLabel ?? `${ref.label}'e ait`) : null,
                          });
                        }
                      }}
                      sx={{ width: 200 }}
                    >
                      <MenuItem value="">— Bağlantı yok —</MenuItem>
                      {linkedRefs.map((ref) => (
                        <MenuItem key={ref.unitId} value={ref.unitId}>{ref.label}</MenuItem>
                      ))}
                    </TextField>
                  ) : null}

                  {/* Ödeme (diger only) */}
                  {showPayment ? (
                    <TextField
                      size="small"
                      label="Ödeme (₺)"
                      value={unit.paymentAmount ?? ''}
                      onChange={(e) => updateUnit(index, { paymentAmount: e.target.value === '' ? null : (parseFloat(e.target.value) || 0) })}
                      onBlur={(e) => {
                        if (e.target.value !== '') updateUnit(index, { paymentAmount: Math.max(0, parseFloat(e.target.value) || 0) });
                      }}
                      inputProps={{ inputMode: 'decimal' }}
                      sx={{ width: 130 }}
                    />
                  ) : null}

                  {/* Merge / Unmerge */}
                  <Box sx={{ display: 'flex', alignItems: 'center', height: 40 }}>
                    {isPrimary ? (
                      <Button size="small" variant="outlined" onClick={() => unmergeUnit(index)} sx={{ fontSize: 11, px: 1 }}>
                        Ayır
                      </Button>
                    ) : units.length >= 2 ? (
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={mergeTargets.length === 0}
                        onClick={() => setMergingIdx(mergingIdx === index ? null : index)}
                        sx={{ fontSize: 11, px: 1 }}
                      >
                        Birleştir
                      </Button>
                    ) : null}
                  </Box>

                  {/* Remove */}
                  <Tooltip title="Birimi kaldır">
                    <span>
                      <IconButton size="small" color="error" disabled={units.length <= 1} onClick={() => removeUnit(index)}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>

                {/* Inline merge target selector */}
                {mergingIdx === index ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 1, pt: 0.5 }}>
                    <TextField
                      size="small" select label="Birleştirilecek birim" value=""
                      onChange={(e) => { if (e.target.value) mergeUnits(index, Number(e.target.value)); }}
                      sx={{ minWidth: 220 }} autoFocus
                    >
                      {mergeTargets.map((t) => (
                        <MenuItem key={t.id} value={t.id}>{t.ownerName} (#{t.id})</MenuItem>
                      ))}
                    </TextField>
                    <Button size="small" onClick={() => setMergingIdx(null)}>İptal</Button>
                  </Box>
                ) : null}
              </Box>
            );
          }

          // ── Non-basement unit row ────────────────────────────────────────────
          return (
            <Box key={index}>
              <Box
                sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '120px 1fr 90px 130px 90px 80px 160px 80px 44px' }, gap: 1, alignItems: 'start' }}
              >
                {/* Sahip tipi */}
                <TextField
                  size="small"
                  select
                  label="Sahip"
                  value={unit.ownerType ?? 'tapu'}
                  onChange={(e) => {
                    const ownerType = e.target.value as 'mila' | 'tapu';
                    updateUnit(index, {
                      ownerType,
                      ownerName: ownerType === 'mila' ? companyName.toUpperCase() : 'TAPU SAHİBİ',
                      paymentAmount: ownerType === 'mila' ? null : unit.paymentAmount,
                    });
                  }}
                >
                  <MenuItem value="mila">{companyName}</MenuItem>
                  <MenuItem value="tapu">Tapu Sahibi</MenuItem>
                </TextField>

                {/* İsim */}
                <TextField size="small" label="İsim" value={unit.ownerName} onChange={(e) => updateUnit(index, { ownerName: e.target.value })} />

                {/* Brüt m² */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                  <TextField
                    size="small"
                    label="Brüt m²"
                    value={unit.brutM2 === 0 && !unit.manualM2Override ? String(autoM2) : String(unit.brutM2)}
                    onChange={(e) => updateUnit(index, { brutM2: parseFloat(e.target.value) || 0, manualM2Override: true })}
                    onBlur={(e) => {
                      const parsed = Math.max(0, parseFloat(e.target.value) || 0);
                      updateUnit(index, { brutM2: parsed, manualM2Override: true });
                    }}
                    inputProps={{ inputMode: 'decimal' }}
                  />
                  {onApplyToAllFloors ? (
                    <Button
                      size="small"
                      sx={{ fontSize: 10, py: 0.25, minHeight: 0, textTransform: 'none' }}
                      onClick={() => {
                        onApplyToAllFloors(index, 'brutM2', unit.brutM2);
                        setFlash({ unitIndex: index, field: 'brutM2' });
                        setTimeout(() => setFlash(null), 1500);
                      }}
                    >
                      {flash?.unitIndex === index && flash.field === 'brutM2' ? '✓ Uygulandı' : '↓ Tüm katlara'}
                    </Button>
                  ) : null}
                </Box>

                {/* Ödeme tutarı */}
                {unit.ownerType === 'tapu' ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    <TextField
                      size="small"
                      label="Ödeme (₺)"
                      value={unit.paymentAmount ?? ''}
                      onChange={(e) => updateUnit(index, { paymentAmount: e.target.value === '' ? null : (parseFloat(e.target.value) || 0) })}
                      onBlur={(e) => {
                        if (e.target.value !== '') {
                          updateUnit(index, { paymentAmount: Math.max(0, parseFloat(e.target.value) || 0) });
                        }
                      }}
                      inputProps={{ inputMode: 'decimal' }}
                    />
                    {onApplyToAllFloors ? (
                      <Button
                        size="small"
                        sx={{ fontSize: 10, py: 0.25, minHeight: 0, textTransform: 'none' }}
                        onClick={() => {
                          onApplyToAllFloors(index, 'paymentAmount', unit.paymentAmount);
                          setFlash({ unitIndex: index, field: 'paymentAmount' });
                          setTimeout(() => setFlash(null), 1500);
                        }}
                      >
                        {flash?.unitIndex === index && flash.field === 'paymentAmount' ? '✓ Uygulandı' : '↓ Tüm katlara'}
                      </Button>
                    ) : null}
                  </Box>
                ) : (
                  <TextField size="small" label="Ödeme (₺)" disabled value="" />
                )}

                {/* Etiket */}
                <TextField size="small" label="Etiket" value={unit.label ?? ''} onChange={(e) => updateUnit(index, { label: e.target.value || null })} />

                {/* Daire No */}
                <TextField
                  size="small"
                  label="Daire No"
                  value={unit.unitNumber ?? ''}
                  onChange={(e) => updateUnit(index, { unitNumber: e.target.value === '' ? null : (parseInt(e.target.value, 10) || null) })}
                  onBlur={(e) => {
                    if (e.target.value !== '') {
                      updateUnit(index, { unitNumber: parseInt(e.target.value, 10) || null });
                    }
                  }}
                  inputProps={{ inputMode: 'numeric' }}
                />

                {/* Bağlı birim */}
                <TextField
                  size="small"
                  select
                  label="Bağlı Birim"
                  value={unit.linkedUnitId ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      updateUnit(index, { linkedUnitId: null, linkedUnitLabel: null });
                    } else {
                      const ref = linkedRefs.find((r) => r.unitId === Number(val));
                      updateUnit(index, {
                        linkedUnitId: Number(val),
                        linkedUnitLabel: ref ? (ref.linkLabel ?? `${ref.label}'e ait`) : null,
                      });
                    }
                  }}
                >
                  <MenuItem value="">— Bağlantı yok —</MenuItem>
                  {linkedRefs.map((ref) => (
                    <MenuItem key={ref.unitId} value={ref.unitId}>{ref.label}</MenuItem>
                  ))}
                </TextField>

                {/* Merge / Unmerge */}
                <Box sx={{ display: 'flex', alignItems: 'center', height: 40 }}>
                  {isPrimary ? (
                    <Button size="small" variant="outlined" onClick={() => unmergeUnit(index)} sx={{ fontSize: 11, px: 1 }}>
                      Ayır
                    </Button>
                  ) : units.length >= 2 ? (
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={mergeTargets.length === 0}
                      onClick={() => setMergingIdx(mergingIdx === index ? null : index)}
                      sx={{ fontSize: 11, px: 1 }}
                    >
                      Birleştir
                    </Button>
                  ) : null}
                </Box>

                {/* Remove */}
                <Tooltip title="Birimi kaldır">
                  <span>
                    <IconButton
                      size="small"
                      color="error"
                      disabled={units.length <= 1}
                      onClick={() => removeUnit(index)}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>

              {/* Inline merge target selector */}
              {mergingIdx === index ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 1, pt: 0.5 }}>
                  <TextField
                    size="small"
                    select
                    label="Birleştirilecek birim"
                    value=""
                    onChange={(e) => { if (e.target.value) mergeUnits(index, Number(e.target.value)); }}
                    sx={{ minWidth: 220 }}
                    autoFocus
                  >
                    {mergeTargets.map((t) => (
                      <MenuItem key={t.id} value={t.id}>{t.ownerName} (#{t.id})</MenuItem>
                    ))}
                  </TextField>
                  <Button size="small" onClick={() => setMergingIdx(null)}>İptal</Button>
                </Box>
              ) : null}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
