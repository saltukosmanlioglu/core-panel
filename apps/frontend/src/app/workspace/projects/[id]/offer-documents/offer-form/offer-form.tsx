'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EditIcon from '@mui/icons-material/Edit';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import dynamic from 'next/dynamic';
import type {
  BasementFloor,
  OfferAlternative,
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
  computeGlobalNumbers,
  DEFAULT_PAGE2_HTML,
  defaultBuilding,
  emptyStreetLabels,
  floorsAreIdentical,
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
  floorAreas?: { floorNumber: number; netArea: number }[] | null;
  companyName: string;
  parcelCalculationId: string | null;
  onCancel: () => void;
  onSave: (payload: OfferDocumentPayload, id?: string) => Promise<OfferDocument>;
  onGeneratePdf: (id: string) => Promise<void>;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function cloneUnits(units: OfferUnit[]): OfferUnit[] {
  return units.map((unit) => ({
    ...unit,
    mergedWithIds: [...(unit.mergedWithIds ?? [])],
  }));
}

function getBuildingUnits(building: OfferBuilding): OfferUnit[] {
  return [
    ...building.basementFloors.flatMap((floor) => floor.units),
    ...(building.groundFloor.exists ? building.groundFloor.units : []),
    ...building.normalFloors.flatMap((floor) => floor.units),
    ...(building.roofFloor.exists ? building.roofFloor.units : []),
  ];
}

function getNextUnitId(building: OfferBuilding, extraUnits: OfferUnit[] = []): number {
  const maxId = [...getBuildingUnits(building), ...extraUnits].reduce((max, unit) => Math.max(max, unit.id), 0);
  return maxId + 1;
}

function createUnitIdFactory(building: OfferBuilding): () => number {
  let nextId = getNextUnitId(building);
  return () => {
    const id = nextId;
    nextId += 1;
    return id;
  };
}

function cloneUnitsWithFreshIds(units: OfferUnit[], nextId: () => number): OfferUnit[] {
  const idMap = new Map<number, number>();
  units.forEach((unit) => idMap.set(unit.id, nextId()));

  return units.map((unit) => ({
    ...unit,
    id: idMap.get(unit.id) ?? unit.id,
    mergedWithIds: (unit.mergedWithIds ?? []).map((id) => idMap.get(id) ?? id),
    isMergedInto: unit.isMergedInto === null ? null : (idMap.get(unit.isMergedInto) ?? unit.isMergedInto),
    linkedUnitId: unit.linkedUnitId === null ? null : (idMap.get(unit.linkedUnitId) ?? unit.linkedUnitId),
  }));
}

function normalizeBuildingUnitIds(building: OfferBuilding): OfferBuilding {
  const usedIds = new Set<number>();
  const preferredGlobalId = new Map<number, number>();
  let nextId = getNextUnitId(building);

  const assignIds = (units: OfferUnit[]): { units: OfferUnit[]; localIdMap: Map<number, number> } => {
    const localIdMap = new Map<number, number>();
    const assignedUnits = units.map((unit) => {
      let id = unit.id;
      if (usedIds.has(id)) {
        id = nextId;
        nextId += 1;
      }
      usedIds.add(id);
      if (!preferredGlobalId.has(unit.id)) preferredGlobalId.set(unit.id, id);
      localIdMap.set(unit.id, id);
      return { ...unit, id, mergedWithIds: [...(unit.mergedWithIds ?? [])] };
    });

    return { units: assignedUnits, localIdMap };
  };

  const remapRelations = (units: OfferUnit[], localIdMap: Map<number, number>): OfferUnit[] =>
    units.map((unit) => ({
      ...unit,
      mergedWithIds: (unit.mergedWithIds ?? []).map((id) => localIdMap.get(id) ?? id),
      isMergedInto: unit.isMergedInto === null ? null : (localIdMap.get(unit.isMergedInto) ?? unit.isMergedInto),
      linkedUnitId: unit.linkedUnitId === null ? null : (preferredGlobalId.get(unit.linkedUnitId) ?? unit.linkedUnitId),
    }));

  const groundResult = assignIds(building.groundFloor.units);
  const normalResults = building.normalFloors.map((floor) => ({ floor, result: assignIds(floor.units) }));
  const roofResult = assignIds(building.roofFloor.units);
  const basementResults = building.basementFloors.map((floor) => ({ floor, result: assignIds(floor.units) }));

  return {
    ...building,
    groundFloor: {
      ...building.groundFloor,
      units: remapRelations(groundResult.units, groundResult.localIdMap),
    },
    normalFloors: normalResults.map(({ floor, result }) => ({
      ...floor,
      units: remapRelations(result.units, result.localIdMap),
    })),
    roofFloor: {
      ...building.roofFloor,
      units: remapRelations(roofResult.units, roofResult.localIdMap),
    },
    basementFloors: basementResults.map(({ floor, result }) => ({
      ...floor,
      units: remapRelations(result.units, result.localIdMap),
    })),
  };
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type FloorDraft =
  | { kind: 'basement'; index: number; floor: BasementFloor }
  | { kind: 'ground'; units: OfferUnit[]; streetLabels: StreetLabels }
  | { kind: 'normal'; index: number; floorNumber: number; units: OfferUnit[] };

function buildPayloadFromDocument(
  document: OfferDocument | null,
  parcelArea: number | null,
  companyName: string,
  parcelCalculationId: string | null,
): OfferDocumentPayload {
  if (document) {
    const alts: OfferAlternative[] =
      document.alternatives && document.alternatives.length > 0
        ? document.alternatives.map((a) => ({ ...a, building: normalizeBuildingUnitIds(a.building) }))
        : [{ id: '1', label: 'Alternatif 1', building: normalizeBuildingUnitIds(document.building) }];
    return {
      parcelTitle: document.parcelTitle,
      offerDate: document.offerDate,
      page2Content: document.page2Content,
      tcmbRate: document.tcmbRate,
      companyName: document.companyName,
      building: alts[0]!.building,
      alternatives: alts,
      parcelCalculationId: document.parcelCalculationId ?? parcelCalculationId,
    };
  }
  const building = defaultBuilding(parcelArea ?? 0);
  const alts: OfferAlternative[] = [{ id: '1', label: 'Alternatif 1', building }];
  return {
    parcelTitle: '',
    offerDate: today(),
    page2Content: DEFAULT_PAGE2_HTML,
    tcmbRate: '1 Dolar (USD): 45,45 TL',
    companyName,
    building,
    alternatives: alts,
    parcelCalculationId,
  };
}


export function OfferForm({
  initialDocument,
  parcelArea,
  floorAreas,
  companyName,
  parcelCalculationId,
  onCancel,
  onSave,
  onGeneratePdf,
}: OfferFormProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [payload, setPayload] = useState<OfferDocumentPayload>(() => buildPayloadFromDocument(initialDocument, parcelArea, companyName, parcelCalculationId));
  const [savedDocument, setSavedDocument] = useState<OfferDocument | null>(initialDocument);
  const [parcelAreaOverride, setParcelAreaOverride] = useState(false);
  const [manualParcelArea, setManualParcelArea] = useState<string>(String(parcelArea ?? 0));
  const [normalFloorsSamePerAlt, setNormalFloorsSamePerAlt] = useState<boolean[]>(() => {
    const initial = buildPayloadFromDocument(initialDocument, parcelArea, companyName, parcelCalculationId);
    return initial.alternatives.map((alt) => floorsAreIdentical(alt.building.normalFloors));
  });
  const [floorDraft, setFloorDraft] = useState<FloorDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeAltTab, setActiveAltTab] = useState(0);
  const [previewAltTab, setPreviewAltTab] = useState(0);

  const activeBuilding = payload.alternatives[activeAltTab]?.building ?? payload.building;
  const normalFloorsSame = normalFloorsSamePerAlt[activeAltTab] ?? true;

  useEffect(() => {
    const newPayload = buildPayloadFromDocument(initialDocument, parcelArea, companyName, parcelCalculationId);
    setPayload(newPayload);
    setSavedDocument(initialDocument);
    setManualParcelArea(String(parcelArea ?? 0));
    setActiveStep(0);
    setNormalFloorsSamePerAlt(newPayload.alternatives.map((alt) => floorsAreIdentical(alt.building.normalFloors)));
    setFloorDraft(null);
    setActiveAltTab(0);
    setPreviewAltTab(0);
  }, [initialDocument, parcelArea, companyName, parcelCalculationId]);

  const tabanAlani = parcelAreaOverride
    ? (parseFloat(manualParcelArea) || 0)
    : (parcelArea ?? (parseFloat(manualParcelArea) || 0));
  const floorNetArea = (fa: typeof floorAreas, floorNumber: number) =>
    fa?.find((f) => f.floorNumber === floorNumber + 1)?.netArea ?? tabanAlani;

  const canSave = payload.parcelTitle.trim() && payload.offerDate && payload.page2Content.trim();

  const updateBuilding = (updater: (building: OfferBuilding) => OfferBuilding) => {
    setPayload((current) => {
      const alts = [...current.alternatives];
      alts[activeAltTab] = { ...alts[activeAltTab]!, building: updater(alts[activeAltTab]!.building) };
      return { ...current, alternatives: alts, building: alts[0]!.building };
    });
  };

  // ── Basement floors ────────────────────────────────────────────────────────

  const addBasementFloor = () => {
    updateBuilding((building) => {
      const idx = building.basementFloors.length;
      const m2 = calculateUnitM2(tabanAlani, 0, 2);
      const nextId = createUnitIdFactory(building);
      const newFloor: BasementFloor = {
        label: `${idx + 1}. BODRUM KAT`,
        isCommonArea: true,
        commonAreaM2: tabanAlani || null,
        commonAreaLabel: 'ORTAK ALAN',
        units: [makeUnit(nextId(), m2, undefined, 'depo'), makeUnit(nextId(), m2, undefined, 'depo')],
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
      const nextId = createUnitIdFactory(building);
      const newFloor = { floorNumber: idx + 1, units: cloneUnitsWithFreshIds(templateUnits, nextId) };
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

  const handleNormalFloorsSameChange = (checked: boolean) => {
    setNormalFloorsSamePerAlt((current) => {
      const next = [...current];
      next[activeAltTab] = checked;
      return next;
    });
    if (!checked) return;
    updateBuilding((building) => {
      const templateUnits = building.normalFloors[0]?.units ?? [];
      const nextId = createUnitIdFactory(building);
      return {
        ...building,
        normalFloors: building.normalFloors.map((floor, index) => ({
          floorNumber: floor.floorNumber,
          units: index === 0 ? cloneUnits(templateUnits) : cloneUnitsWithFreshIds(templateUnits, nextId),
        })),
      };
    });
  };

  const openFloorEditor = (target: { kind: 'basement'; index: number } | { kind: 'ground' } | { kind: 'normal'; index: number }) => {
    const b = activeBuilding;
    if (target.kind === 'basement') {
      const floor = b.basementFloors[target.index];
      if (floor) setFloorDraft({ kind: 'basement', index: target.index, floor: deepClone(floor) });
    } else if (target.kind === 'ground') {
      setFloorDraft({ kind: 'ground', units: deepClone(b.groundFloor.units), streetLabels: deepClone(b.groundFloor.streetLabels) });
    } else {
      const floor = b.normalFloors[target.index];
      if (floor) setFloorDraft({ kind: 'normal', index: target.index, floorNumber: floor.floorNumber, units: deepClone(floor.units) });
    }
  };

  const saveFloorDraft = (draft: FloorDraft) => {
    updateBuilding((building) => {
      if (draft.kind === 'basement') {
        const basementFloors = [...building.basementFloors];
        basementFloors[draft.index] = draft.floor;
        return { ...building, basementFloors };
      }
      if (draft.kind === 'ground') {
        return { ...building, groundFloor: { ...building.groundFloor, units: draft.units, streetLabels: draft.streetLabels } };
      }
      if (draft.kind === 'normal') {
        const nextId = createUnitIdFactory(building);
        const normalFloors = normalFloorsSame
          ? building.normalFloors.map((f, i) => ({
            ...f,
            units: i === draft.index ? draft.units : cloneUnitsWithFreshIds(draft.units, nextId),
          }))
          : building.normalFloors.map((f, i) => (i === draft.index ? { ...f, units: draft.units } : f));
        return { ...building, normalFloors };
      }
      return building;
    });
    setFloorDraft(null);
  };

  const addAlternative = () => {
    if (payload.alternatives.length >= 5) return;
    const lastAlt = payload.alternatives[payload.alternatives.length - 1]!;
    const newIndex = payload.alternatives.length;
    const newAlt: OfferAlternative = {
      id: String(Date.now()),
      label: `Alternatif ${newIndex + 1}`,
      building: deepClone(lastAlt.building),
    };
    setPayload((current) => {
      const alts = [...current.alternatives, newAlt];
      return { ...current, alternatives: alts };
    });
    setNormalFloorsSamePerAlt((current) => [...current, floorsAreIdentical(newAlt.building.normalFloors)]);
    setActiveAltTab(newIndex);
    setFloorDraft(null);
  };

  const removeAlternative = (index: number) => {
    if (payload.alternatives.length <= 1) return;
    setPayload((current) => {
      const alts = current.alternatives.filter((_, i) => i !== index);
      return { ...current, alternatives: alts, building: alts[0]!.building };
    });
    setNormalFloorsSamePerAlt((current) => current.filter((_, i) => i !== index));
    setActiveAltTab((current) => Math.min(current, payload.alternatives.length - 2));
    setFloorDraft(null);
  };

  const setAlternativeLabel = (index: number, label: string) => {
    setPayload((current) => {
      const alts = [...current.alternatives];
      alts[index] = { ...alts[index]!, label };
      return { ...current, alternatives: alts };
    });
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

  const previewBuilding = useMemo(() => activeBuilding, [activeBuilding]);
  const previewNumberMap = useMemo(() => computeGlobalNumbers(activeBuilding), [activeBuilding]);

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
          {parcelArea != null ? (
            <Box sx={{ p: 1.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 1 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}>
                Parsel Hesaplama Verileri
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5 }}>
                <Box>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Taban Oturum Alanı</Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{parcelArea.toFixed(2)} m²</Typography>
                </Box>
                {floorAreas?.find((f) => f.floorNumber === 2) ? (
                  <Box>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Zemin Kat Sonrası Kat Alanı</Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{floorAreas.find((f) => f.floorNumber === 2)!.netArea.toFixed(2)} m²</Typography>
                  </Box>
                ) : null}
                {floorAreas ? (
                  <Box>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Kat Sayısı</Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{floorAreas.length}</Typography>
                  </Box>
                ) : null}
              </Box>
            </Box>
          ) : (
            <Box sx={{ p: 1.5, bgcolor: '#fefce8', border: '1px solid #fde047', borderRadius: 1 }}>
              <Typography sx={{ fontSize: 12, color: '#92400e' }}>
                Bu proje için kayıtlı parsel hesaplama bulunamadı. Lütfen önce parsel hesaplama yapın.
              </Typography>
            </Box>
          )}
          <TextField
            label="Parsel başlığı"
            value={payload.parcelTitle}
            onChange={(e) => setPayload((c) => ({ ...c, parcelTitle: e.target.value }))}
            fullWidth
          />
          <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
            <Box sx={{ flex: 1 }}>
              <TextField
                label="Teklif tarihi"
                type="date"
                value={payload.offerDate}
                onChange={(e) => setPayload((c) => ({ ...c, offerDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <TextField
                label="TCMB dolar kuru"
                value={payload.tcmbRate}
                onChange={(e) => setPayload((c) => ({ ...c, tcmbRate: e.target.value }))}
                fullWidth
              />
            </Box>
          </Box>
          <Box>
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
              fullWidth
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
        <Stack spacing={3}>
          {/* ── Alternative tabs ── */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, borderBottom: 1, borderColor: 'divider' }}>
            <Box
              role="tablist"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 0, overflowX: 'auto' }}
            >
              {payload.alternatives.map((alt, i) => (
                <Box key={alt.id} sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                  <Tab
                    value={i}
                    role="tab"
                    aria-selected={activeAltTab === i}
                    tabIndex={activeAltTab === i ? 0 : -1}
                    onClick={() => { setActiveAltTab(i); setFloorDraft(null); }}
                    label={alt.label}
                    sx={{
                      textTransform: 'none',
                      minHeight: 42,
                      pr: payload.alternatives.length > 1 ? 4 : 2,
                      borderBottom: activeAltTab === i ? 2 : 0,
                      borderColor: 'primary.main',
                    }}
                  />
                  {payload.alternatives.length > 1 ? (
                    <IconButton
                      size="small"
                      aria-label={`${alt.label} alternatifini sil`}
                      onClick={(e) => { e.stopPropagation(); removeAlternative(i); }}
                      sx={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', p: 0.25 }}
                    >
                      <CloseIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  ) : null}
                </Box>
              ))}
            </Box>
            {payload.alternatives.length < 5 ? (
              <Tooltip title="Yeni alternatif ekle">
                <IconButton onClick={addAlternative} size="small" sx={{ flexShrink: 0 }}>
                  <AddIcon />
                </IconButton>
              </Tooltip>
            ) : null}
          </Box>

          {/* Editable label for active alternative */}
          <TextField
            size="small"
            label="Alternatif adı"
            value={payload.alternatives[activeAltTab]?.label ?? ''}
            onChange={(e) => setAlternativeLabel(activeAltTab, e.target.value)}
            sx={{ maxWidth: 240 }}
          />

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              gap: 2,
              alignItems: 'flex-start',
              width: '100%',
            }}
          >
            {/* Katlar */}
            <Box sx={{ flex: 1, minWidth: 0, width: { xs: '100%', md: 0 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControlLabel
                control={<Checkbox checked={normalFloorsSame} onChange={(e) => handleNormalFloorsSameChange(e.target.checked)} />}
                label="Tüm katlar aynı"
                sx={{ mr: 0 }}
              />
              {normalFloorsSame && activeBuilding.normalFloors.length > 1 ? (
                <Alert severity="info" sx={{ py: 0.5, fontSize: 13 }}>
                  Tüm katlar senkronize — bir kattaki değişiklik diğer katlara yansır
                </Alert>
              ) : null}
              <Box>
                <Button startIcon={<AddIcon />} onClick={addNormalFloor} variant="outlined" size="small">
                  Kat Ekle
                </Button>
              </Box>
              {activeBuilding.normalFloors.length === 0 ? (
                <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>Henüz kat eklenmedi.</Typography>
              ) : null}
              {[...activeBuilding.normalFloors].reverse().map((floor) => {
                const index = activeBuilding.normalFloors.findIndex((f) => f.floorNumber === floor.floorNumber);
                return (
                  <FloorCard
                    key={floor.floorNumber}
                    label={`${floor.floorNumber}. Kat`}
                    units={floor.units}
                    tabanAlani={tabanAlani}
                    isBasement={false}
                    companyName={companyName}
                    synced={normalFloorsSame && activeBuilding.normalFloors.length > 1}
                    onEdit={() => openFloorEditor({ kind: 'normal', index })}
                    onRemove={() => removeNormalFloor(index)}
                    canRemove
                  />
                );
              })}
            </Box>

            {/* Zemin kat + bodrum katlar + çatı katı */}
            <Box sx={{ flex: 1, minWidth: 0, width: { xs: '100%', md: 0 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Switch
                  checked={activeBuilding.groundFloor.exists}
                  onChange={(e) => updateBuilding((b) => ({ ...b, groundFloor: { ...b.groundFloor, exists: e.target.checked } }))}
                />
                <Typography sx={{ fontWeight: 600 }}>Zemin Kat</Typography>
              </Box>
              {activeBuilding.groundFloor.exists ? (
                <FloorCard
                  label="Zemin Kat"
                  units={activeBuilding.groundFloor.units}
                  tabanAlani={tabanAlani}
                  isBasement={false}
                  companyName={companyName}
                  onEdit={() => openFloorEditor({ kind: 'ground' })}
                />
              ) : null}

              <Divider />

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary' }}>Bodrum Katlar</Typography>
                <Button startIcon={<AddIcon />} onClick={addBasementFloor} variant="outlined" size="small">
                  Bodrum Kat Ekle
                </Button>
              </Box>
              {activeBuilding.basementFloors.map((floor, index) => (
                <FloorCard
                  key={index}
                  label={floor.label}
                  units={floor.units}
                  isCommonArea={floor.isCommonArea}
                  commonAreaM2={floor.commonAreaM2}
                  commonAreaLabel={floor.commonAreaLabel}
                  tabanAlani={tabanAlani}
                  isBasement
                  companyName={companyName}
                  onEdit={() => openFloorEditor({ kind: 'basement', index })}
                  onRemove={() => removeBasementFloor(index)}
                  canRemove={activeBuilding.basementFloors.length > 1}
                />
              ))}

              <Divider />

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Switch
                  checked={activeBuilding.roofFloor.exists}
                  onChange={(e) => updateBuilding((b) => ({ ...b, roofFloor: { ...b.roofFloor, exists: e.target.checked } }))}
                />
                <Typography sx={{ fontWeight: 600 }}>Çatı Katı</Typography>
              </Box>
              {activeBuilding.roofFloor.exists ? (
                <UnitsEditor
                  title="Çatı Katı"
                  units={activeBuilding.roofFloor.units}
                  tabanAlani={tabanAlani}
                  allFloors={activeBuilding}
                  numberMap={previewNumberMap}
                  companyName={companyName}
                  onChange={(units) => updateBuilding((b) => ({ ...b, roofFloor: { ...b.roofFloor, units } }))}
                />
              ) : null}
            </Box>
          </Box>

          <BuildingPreview parcelTitle={payload.parcelTitle} building={previewBuilding} floorAreas={floorAreas} />

          <FloorEditorModal
            key={floorDraft ? `${floorDraft.kind}-${floorDraft.kind !== 'ground' ? (floorDraft as { index: number }).index : 0}` : 'closed'}
            floorDraft={floorDraft}
            building={activeBuilding}
            tabanAlani={floorDraft?.kind === 'normal' ? floorNetArea(floorAreas, floorDraft.floorNumber) : tabanAlani}
            companyName={companyName}
            normalFloorsSame={normalFloorsSame}
            onSave={saveFloorDraft}
            onCancel={() => setFloorDraft(null)}
          />
        </Stack>
      ) : null}

      {/* ── Step 3: Önizleme ── */}
      {activeStep === 3 ? (
        <Stack spacing={2}>
          <Alert severity="info">Teklif kaydedildikten sonra PDF oluşturulur. Eksik statik sayfa dosyası varsa PDF yalnızca ilk 3 sayfa olarak üretilecektir.</Alert>
          {payload.alternatives.length > 1 ? (
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={previewAltTab} onChange={(_, v: number) => setPreviewAltTab(v)}>
                {payload.alternatives.map((alt, i) => (
                  <Tab key={alt.id} value={i} label={alt.label} sx={{ textTransform: 'none' }} />
                ))}
              </Tabs>
            </Box>
          ) : null}
          <BuildingPreview
            parcelTitle={payload.parcelTitle}
            building={payload.alternatives[previewAltTab]?.building ?? activeBuilding}
            floorAreas={floorAreas}
          />
          <Button variant="contained" onClick={() => void handleGeneratePdf()} disabled={isSaving}>
            PDF Oluştur{payload.alternatives.length > 1 ? ` (${payload.alternatives.length} alternatif)` : ''}
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

// ── FloorCard ────────────────────────────────────────────────────────────────

function FloorCard({
  label,
  units,
  isCommonArea,
  commonAreaM2,
  commonAreaLabel,
  tabanAlani,
  isBasement,
  companyName,
  synced,
  onEdit,
  onRemove,
  canRemove,
}: {
  label: string;
  units: OfferUnit[];
  isCommonArea?: boolean;
  commonAreaM2?: number | null;
  commonAreaLabel?: string | null;
  tabanAlani: number;
  isBasement: boolean;
  companyName: string;
  synced?: boolean;
  onEdit: () => void;
  onRemove?: () => void;
  canRemove?: boolean;
}) {
  const visibleUnits = units.filter((u) => !u.isMergedInto);
  const totalM2 = visibleUnits.reduce((s, u) => s + u.brutM2, 0);
  const tapuCount = visibleUnits.filter((u) => u.ownerType === 'tapu').length;
  const milaCount = visibleUnits.filter((u) => u.ownerType === 'mila').length;
  const nullCount = visibleUnits.filter((u) => u.ownerType === null).length;
  const netAlan = tabanAlani;
  const hasWarning =
    !isCommonArea &&
    visibleUnits.length > 0 &&
    (isBasement ? totalM2 > tabanAlani : totalM2 > netAlan);

  return (
    <Box
      sx={{
        border: '1px solid #e5e7eb',
        borderRadius: 1,
        p: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{label}</Typography>
          {synced ? <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>🔄</Typography> : null}
          {hasWarning ? (
            <Tooltip
              title={
                isBasement
                  ? `Toplam m² (${totalM2.toFixed(2)}) taban alanını (${tabanAlani}) aşıyor`
                  : `Toplam m² (${totalM2.toFixed(2)}) net alanı (${netAlan.toFixed(2)}) aşıyor`
              }
            >
              <WarningAmberIcon
                sx={{ fontSize: 16, color: isBasement ? 'warning.main' : 'error.main' }}
              />
            </Tooltip>
          ) : null}
        </Box>
        {isCommonArea ? (
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            Ortak Alan · {commonAreaM2 ?? 0} m² · {commonAreaLabel ?? 'ORTAK ALAN'}
          </Typography>
        ) : (
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            {visibleUnits.length} birim · {totalM2.toFixed(2)} m²
            {tapuCount > 0 ? ` · Tapu(${tapuCount})` : ''}
            {milaCount > 0 ? ` · ${companyName}(${milaCount})` : ''}
            {nullCount > 0 ? ` · Diğer(${nullCount})` : ''}
          </Typography>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
        <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={onEdit}>
          Düzenle
        </Button>
        {canRemove && onRemove ? (
          <Tooltip title="Katı kaldır">
            <IconButton size="small" color="error" onClick={onRemove}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null}
      </Box>
    </Box>
  );
}

function buildingWithDraft(building: OfferBuilding, draft: FloorDraft | null): OfferBuilding {
  if (!draft) return building;

  if (draft.kind === 'basement') {
    const basementFloors = [...building.basementFloors];
    basementFloors[draft.index] = draft.floor;
    return { ...building, basementFloors };
  }

  if (draft.kind === 'ground') {
    return { ...building, groundFloor: { ...building.groundFloor, units: draft.units, streetLabels: draft.streetLabels } };
  }

  return {
    ...building,
    normalFloors: building.normalFloors.map((floor, index) =>
      index === draft.index ? { ...floor, units: draft.units } : floor,
    ),
  };
}

// ── FloorEditorModal ─────────────────────────────────────────────────────────

function FloorEditorModal({
  floorDraft,
  building,
  tabanAlani,
  companyName,
  normalFloorsSame,
  onSave,
  onCancel,
}: {
  floorDraft: FloorDraft | null;
  building: OfferBuilding;
  tabanAlani: number;
  companyName: string;
  normalFloorsSame: boolean;
  onSave: (draft: FloorDraft) => void;
  onCancel: () => void;
}) {
  const [localDraft, setLocalDraft] = useState<FloorDraft | null>(() =>
    floorDraft ? deepClone(floorDraft) : null,
  );

  const open = floorDraft !== null;
  const draftBuilding = buildingWithDraft(building, localDraft);
  const draftNumberMap = computeGlobalNumbers(draftBuilding);

  const title =
    !localDraft ? '' :
    localDraft.kind === 'basement' ? `${localDraft.floor.label} Düzenle` :
    localDraft.kind === 'ground' ? 'Zemin Kat Düzenle' :
    `${localDraft.floorNumber}. Kat Düzenle`;

  // Validation
  let validationAlert: React.ReactNode = null;
  if (localDraft?.kind === 'ground' || localDraft?.kind === 'normal') {
    const visibleUnits = localDraft.units.filter((u) => !u.isMergedInto);
    const totalM2 = visibleUnits.reduce((s, u) => s + u.brutM2, 0);
    const netAlan = tabanAlani;
    if (totalM2 > netAlan) {
      validationAlert = (
        <Alert severity="error">
          Birim toplamı ({totalM2.toFixed(2)} m²) net alanı ({netAlan.toFixed(2)} m²) aşıyor.
        </Alert>
      );
    }
  } else if (localDraft?.kind === 'basement' && !localDraft.floor.isCommonArea) {
    const visibleUnits = localDraft.floor.units.filter((u) => !u.isMergedInto);
    const totalM2 = visibleUnits.reduce((s, u) => s + u.brutM2, 0);
    if (totalM2 > tabanAlani) {
      validationAlert = (
        <Alert severity="warning">
          Birim toplamı ({totalM2.toFixed(2)} m²) taban alanını ({tabanAlani} m²) aşıyor.
        </Alert>
      );
    }
  }

  if (!localDraft) {
    return <Dialog open={open} onClose={onCancel} maxWidth="lg" fullWidth><DialogContent /></Dialog>;
  }

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {title}
        {localDraft.kind === 'normal' && normalFloorsSame && building.normalFloors.length > 1 ? (
          <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 400 }}>
            (tüm katlara uygulanacak)
          </Typography>
        ) : null}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {validationAlert}

          {localDraft.kind === 'basement' ? (
            <>
              <TextField
                size="small"
                label="Kat etiketi"
                value={localDraft.floor.label}
                onChange={(e) =>
                  setLocalDraft({ ...localDraft, floor: { ...localDraft.floor, label: e.target.value } })
                }
                fullWidth
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={localDraft.floor.isCommonArea}
                    onChange={(e) =>
                      setLocalDraft({ ...localDraft, floor: { ...localDraft.floor, isCommonArea: e.target.checked } })
                    }
                  />
                }
                label="Ortak Alan"
              />
              {localDraft.floor.isCommonArea ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  <TextField
                    label="Alan m²"
                    size="small"
                    value={localDraft.floor.commonAreaM2 ?? ''}
                    onChange={(e) =>
                      setLocalDraft({
                        ...localDraft,
                        floor: {
                          ...localDraft.floor,
                          commonAreaM2: e.target.value === '' ? null : parseFloat(e.target.value) || 0,
                        },
                      })
                    }
                    onBlur={(e) => {
                      if (e.target.value !== '') {
                        setLocalDraft({
                          ...localDraft,
                          floor: {
                            ...localDraft.floor,
                            commonAreaM2: Math.max(0, parseFloat(e.target.value) || 0),
                          },
                        });
                      }
                    }}
                    inputProps={{ inputMode: 'decimal' }}
                  />
                  <TextField
                    size="small"
                    label="Alan etiketi"
                    value={localDraft.floor.commonAreaLabel ?? ''}
                    onChange={(e) =>
                      setLocalDraft({ ...localDraft, floor: { ...localDraft.floor, commonAreaLabel: e.target.value } })
                    }
                  />
                </Box>
              ) : (
                <UnitsEditor
                  title={`${localDraft.floor.label} Birimleri`}
                  units={localDraft.floor.units}
                  tabanAlani={tabanAlani}
                  allFloors={draftBuilding}
                  numberMap={draftNumberMap}
                  isBasement
                  companyName={companyName}
                  onChange={(units) =>
                    setLocalDraft({ ...localDraft, floor: { ...localDraft.floor, units } })
                  }
                />
              )}
            </>
          ) : localDraft.kind === 'ground' ? (
            <>
              <UnitsEditor
                title="Zemin Kat Birimleri"
                units={localDraft.units}
                tabanAlani={tabanAlani}
                allFloors={draftBuilding}
                numberMap={draftNumberMap}
                companyName={companyName}
                onChange={(units) => setLocalDraft({ ...localDraft, units })}
              />
            </>
          ) : (
            <>
              {normalFloorsSame && building.normalFloors.length > 1 ? (
                <Alert severity="info">Değişiklikler tüm katlara uygulanacak.</Alert>
              ) : null}
              <UnitsEditor
                title={`${localDraft.floorNumber}. Kat Birimleri`}
                units={localDraft.units}
                tabanAlani={tabanAlani}
                allFloors={draftBuilding}
                numberMap={draftNumberMap}
                companyName={companyName}
                onChange={(units) => setLocalDraft({ ...localDraft, units })}
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>İptal</Button>
        <Button variant="contained" onClick={() => onSave(localDraft)}>
          Kaydet
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Helper: collect units for linkedUnit dropdown ────────────────────────────

interface UnitRef {
  id: number;
  unitId: number;
  label: string;       // shown in the dropdown
  linkLabel?: string;  // stored as linkedUnitLabel on the unit
}

function UnitNumberBadge({ value, reserveSpace = false }: { value?: string; reserveSpace?: boolean }) {
  if (!value) return reserveSpace ? <Box sx={{ width: 44 }} /> : null;

  return (
    <Box
      sx={{
        minWidth: 36,
        height: 32,
        px: 0.75,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 1,
        bgcolor: '#1B3A5C',
        color: '#fff',
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}
    >
      #{value}
    </Box>
  );
}

function collectAboveGroundUnits(building: OfferBuilding): UnitRef[] {
  const numMap = computeGlobalNumbers(building);
  const refs: UnitRef[] = [];

  const pushUnit = (floorLabel: string, unit: OfferUnit) => {
    if (unit.isMergedInto || (unit.unitType !== 'daire' && unit.unitType !== 'dukkan')) return;
    const globalNum = numMap.get(unit.id);
    const typeLabel = unit.unitType === 'dukkan' ? 'Dükkan' : 'Daire';
    const numberLabel = globalNum ?? String(unit.id);

    refs.push({
      id: unit.id,
      unitId: unit.id,
      label: `${floorLabel} - ${typeLabel} #${numberLabel} (${unit.ownerName})`,
      linkLabel: `${floorLabel} ${typeLabel} ${numberLabel}'e ait`,
    });
  };

  if (building.groundFloor.exists) {
    building.groundFloor.units.forEach((unit) => pushUnit('Zemin Kat', unit));
  }

  building.normalFloors
    .slice()
    .sort((a, b) => a.floorNumber - b.floorNumber)
    .forEach((floor) => {
      floor.units.forEach((unit) => pushUnit(`${floor.floorNumber}. Kat`, unit));
    });

  if (building.roofFloor.exists) {
    building.roofFloor.units.forEach((unit) => pushUnit('Çatı Katı', unit));
  }

  return refs;
}

// ── UnitsEditor ──────────────────────────────────────────────────────────────

function UnitsEditor({
  title,
  units,
  tabanAlani,
  allFloors,
  numberMap,
  isBasement,
  companyName,
  onChange,
}: {
  title: string;
  units: OfferUnit[];
  tabanAlani: number;
  allFloors: OfferBuilding;
  numberMap?: Map<number, string>;
  isBasement?: boolean;
  companyName: string;
  onChange: (units: OfferUnit[]) => void;
}) {
  const [mergingIdx, setMergingIdx] = useState<number | null>(null);

  // Count only primary (non-merged-secondary) units for auto m² computation
  const primaryCount = Math.max(1, units.filter((u) => !u.isMergedInto).length);
  const autoM2 = calculateUnitM2(tabanAlani, 0, primaryCount);
  const linkedRefs = collectAboveGroundUnits(allFloors);

  const updateUnit = (index: number, patch: Partial<OfferUnit>) => {
    onChange(units.map((unit, i) => (i === index ? { ...unit, ...patch } : unit)));
  };

  const addUnit = () => {
    const defaultUnitType: UnitType = isBasement ? 'depo' : 'daire';
    const newUnit = makeUnit(getNextUnitId(allFloors, units), autoM2, undefined, defaultUnitType);
    const recalc = [...units, newUnit].map((u) =>
      u.manualM2Override ? u : { ...u, brutM2: calculateUnitM2(tabanAlani, 0, units.length + 1) },
    );
    onChange(recalc);
  };

  const removeUnit = (index: number) => {
    if (units.length <= 1) return;
    const next = units.filter((_, i) => i !== index);
    const recalcM2 = calculateUnitM2(tabanAlani, 0, Math.max(1, next.length));
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
      if (i === primaryIdx) return { ...u, mergedWithIds: [...(u.mergedWithIds ?? []), secondaryId], brutM2: combinedM2, manualM2Override: true };
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
          const globalNumber = numberMap?.get(unit.id);

          // Secondary (absorbed) unit — show collapsed indicator
          if (unit.isMergedInto != null) {
            const mergedIntoNumber = numberMap?.get(unit.isMergedInto) ?? String(unit.isMergedInto);
            return (
              <Box
                key={index}
                sx={{ p: 1, bgcolor: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 1, opacity: 0.65 }}
              >
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  Birim {globalNumber ? `#${globalNumber}` : `#${unit.id}`} ({unit.ownerName}) — #{mergedIntoNumber} ile birleştirildi
                </Typography>
              </Box>
            );
          }

          const isPrimary = (unit.mergedWithIds?.length ?? 0) > 0;
          const mergeTargets = getMergeTargets(index);

          if (isBasement) {
            // ── Basement unit row ──────────────────────────────────────────────
            const unitType = unit.unitType ?? 'depo';
            const isNumberedBasementUnit = unitType === 'daire' || unitType === 'dukkan';
            const showOwner = isNumberedBasementUnit || unitType === 'depo' || unitType === 'diger';
            const showPayment = (isNumberedBasementUnit || unitType === 'diger') && unit.ownerType === 'tapu';
            const showLinked = isNumberedBasementUnit;

            const handleUnitTypeChange = (newType: UnitType) => {
              const isNullOwnerType = newType === 'ortak_alan' || newType === 'siginak';
              const newOwnerType = isNullOwnerType ? null : (unit.ownerType === null ? 'tapu' : unit.ownerType);
              const nameMap: Partial<Record<UnitType, string>> = {
                daire: 'TAPU SAHİBİ',
                dukkan: 'TAPU SAHİBİ',
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
              if (newType !== 'daire' && newType !== 'dukkan') {
                patch.linkedUnitId = null;
                patch.linkedUnitLabel = null;
              }
              if (newType === 'depo') patch.paymentAmount = null;
              updateUnit(index, patch);
            };

            return (
              <Box key={index}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'start' }}>
                  <UnitNumberBadge value={globalNumber} />

                  {/* Birim Tipi */}
                  <TextField
                    size="small"
                    select
                    label="Birim Tipi"
                    value={unitType}
                    onChange={(e) => handleUnitTypeChange(e.target.value as UnitType)}
                    sx={{ width: 130 }}
                  >
                    <MenuItem value="daire">Daire</MenuItem>
                    <MenuItem value="dukkan">Dükkan</MenuItem>
                    <MenuItem value="depo">Depo</MenuItem>
                    <MenuItem value="siginak">Sığınak</MenuItem>
                    <MenuItem value="ortak_alan">Ortak Alan</MenuItem>
                    <MenuItem value="diger">Diğer</MenuItem>
                  </TextField>

                  {/* Sahip */}
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

                  {/* Bağlı Birim */}
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
                      {linkedRefs.filter((ref) => ref.unitId !== unit.id).map((ref) => (
                        <MenuItem key={`${ref.unitId}-${ref.label}`} value={ref.unitId}>{ref.label}</MenuItem>
                      ))}
                    </TextField>
                  ) : null}

                  {/* Ödeme */}
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
                        <MenuItem key={t.id} value={t.id}>{t.ownerName} (#{numberMap?.get(t.id) ?? t.id})</MenuItem>
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
                sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '44px 120px 1fr 90px 120px 90px 160px 80px 44px' }, gap: 1, alignItems: 'start' }}
              >
                <UnitNumberBadge value={globalNumber} reserveSpace />

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

                {/* Ödeme tutarı */}
                {unit.ownerType === 'tapu' ? (
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
                ) : (
                  <TextField size="small" label="Ödeme (₺)" disabled value="" />
                )}

                {/* Etiket */}
                <TextField size="small" label="Etiket" value={unit.label ?? ''} onChange={(e) => updateUnit(index, { label: e.target.value || null })} />

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
                  {linkedRefs.filter((ref) => ref.unitId !== unit.id).map((ref) => (
                    <MenuItem key={`${ref.unitId}-${ref.label}`} value={ref.unitId}>{ref.label}</MenuItem>
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
                      <MenuItem key={t.id} value={t.id}>{t.ownerName} (#{numberMap?.get(t.id) ?? t.id})</MenuItem>
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
