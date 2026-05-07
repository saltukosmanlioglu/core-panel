'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import type { FloorPlanExport, FloorPlanRoom, RoughEstimate, RoughEstimatePayload, RoughEstimateUnitPayload, RoughEstimateWithUnits, PropertyOwner } from '@core-panel/shared';
import { OwnerType, UnitType } from '@core-panel/shared';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Snackbar,
  Step,
  StepLabel,
  Stepper,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  FormatAlignCenter as FormatAlignCenterIcon,
  FormatAlignLeft as FormatAlignLeftIcon,
  FormatAlignRight as FormatAlignRightIcon,
  FormatBold as FormatBoldIcon,
  FormatItalic as FormatItalicIcon,
  FormatListBulleted as FormatListBulletedIcon,
  FormatListNumbered as FormatListNumberedIcon,
  FormatUnderlined as FormatUnderlinedIcon,
  Redo as RedoIcon,
  RestartAlt as RestartAltIcon,
  Save as SaveIcon,
  Title as TitleIcon,
  Undo as UndoIcon,
} from '@mui/icons-material';
import { getLatestAreaCalculationApi } from '@/services/area-calculations/api';
import { getLatestFloorPlanExportApi } from '@/services/floor-plan-exports/api';
import { bulkUpsertPropertyOwnersApi, getPropertyOwnersApi } from '@/services/property-owners/api';
import { getProjectApi } from '@/services/workspace/api';
import {
  createRoughEstimateApi,
  deleteRoughEstimateApi,
  downloadRoughEstimateExcelApi,
  downloadRoughEstimatePdfApi,
  getRoughEstimateApi,
  getRoughEstimatesApi,
  updateRoughEstimateApi,
} from '@/services/rough-estimates/api';

const steps = ['Alan Hesabı', 'Daire Dağılımı', 'Maliyet ve Teklif', 'Önizleme ve Çıktı'];

const DEFAULT_OFFER_TITLE = 'YARISI BİZDEN KAMPANYASI İLE ANAHTAR TESLİMİ GÖTÜRÜ BEDELLE İNŞAAT YAPIMI';

const DEFAULT_OFFER_HTML = `
<p><strong>1. İnşaat yapımının çok kısa zamanda gerçekleşmesi ve kat maliklerinin kısa sürede yeni binaya taşınabilmeleri için aşağıda belirtilen 2 maddede karşılıklı olarak mutabık olunmalıdır;</strong></p>
<ul>
  <li>Tüm kat maliklerinin yeniden yapıma mutabakat vermesi</li>
  <li>Kat malikleri kendi paylarına düşen bedelleri ödemesi</li>
</ul>
<p><strong>2. Teklife dahil olan işler;</strong></p>
<ul>
  <li>Mevzuat gereği yapılacak olan 1. Bodrum kat bedeli</li>
  <li>Bina yıkım ruhsatı ve yıkım bedeli</li>
  <li>Proje ve inşaat ruhsat bedeli</li>
  <li>Onaylı projesindeki tüm imalatlar bedeli</li>
</ul>
<p><strong>3. Diğer kurallar;</strong></p>
<ol>
  <li>Ruhsat alındığından itibaren inşaat teslim süresi {{delivery_months}} aydır.</li>
  <li>İmar planındaki şartlara göre brüt inşaat alanı {{total_brut_area}} m²'dir. Buna ilave olarak {{basement_area}} m² bodrum kat eklendiğinde {{total_with_basement}} m² toplam inşaat alanı olacaktır.</li>
  <li>Teklifimiz sabit bedelli anahtar teslimi inşaat yapımını kapsamakta olup tapu ve imar durumundaki verilere göre hazırlanmıştır. Bağımsız bölüm malikleri ekteki tabloya göre ödeme yapacaktır.</li>
  <li>Tablodaki daire brüt alanları yaklaşık olarak hesaplanmıştır. Kesin daire alanları bina yönetimi ile koordineli olarak kesin proje safhasında netleştirilecektir.</li>
  <li>İnşaat, en son (2018 yılı) Türkiye Bina Deprem Yönetmeliğine göre inşa edilecektir.</li>
  <li>Zemin etüd raporu alındığında zeminle ilgili zemin ıslahı, fore kazık ya da iksa gibi ilave işlemler gerekmesi halinde çıkan bedel kat maliklerinden tahsil edilecektir.</li>
  <li>Mevcut binanın bodrum kat dahil toplam alanı yeni yapılacak inşaatın otopark dahil brüt inşaat alanı ve mevcut binanın bağımsız bölüm sayısı yeni durumda 1,5 katını geçmesi halinde yarısı bizden bakanlık desteklerinden faydalanamamaktadır.</li>
  <li>Yeni yapılacak yapıya ilişkin paylaşım ve ödeme şartlarında kat malikleri ile mutabık kalınması halinde, diğer ayrıntılar sözleşme sayfasında ikmal edilecektir.</li>
  <li>Teklifimiz {{offer_valid_until}} tarihine kadar geçerlidir.</li>
</ol>
`.trim();

const templateVariables = [
  ['{{delivery_months}}', 'teslim süresi'],
  ['{{total_brut_area}}', 'toplam brüt alan'],
  ['{{basement_area}}', 'bodrum kat alanı'],
  ['{{total_with_basement}}', 'bodrum dahil toplam'],
  ['{{offer_valid_until}}', 'geçerlilik tarihi'],
  ['{{net_area}}', 'net parsel alanı'],
] as const;

interface EstimateForm {
  netParcelArea: number | null;
  taksMin: number | null;
  taksMax: number | null;
  kaks: number | null;
  regulationBonusPercent: number;
  basementArea: number;
  secondBasementArea: number;
  thirdBasementArea: number;
  floorCount: number;
  unitsPerFloor: number;
  hasRoofUnit: boolean;
  roofUnitArea: number;
  totalConstructionCost: number | null;
  currency: string;
  usdRate: number | null;
  projectTitle: string;
  offerValidUntil: string;
  deliveryMonths: number;
  offerLetterTitle: string;
  offerLetterContent: string;
  notes: string;
  status: string;
}

type LocalUnit = RoughEstimateUnitPayload & { localId: string };
type GroundFloorType = 'apartment' | 'shop' | 'mixed';

const emptyForm: EstimateForm = {
  netParcelArea: null,
  taksMin: null,
  taksMax: null,
  kaks: null,
  regulationBonusPercent: 30,
  basementArea: 0,
  secondBasementArea: 0,
  thirdBasementArea: 0,
  floorCount: 4,
  unitsPerFloor: 2,
  hasRoofUnit: false,
  roofUnitArea: 0,
  totalConstructionCost: null,
  currency: 'TRY',
  usdRate: null,
  projectTitle: '',
  offerValidUntil: '',
  deliveryMonths: 10,
  offerLetterTitle: DEFAULT_OFFER_TITLE,
  offerLetterContent: DEFAULT_OFFER_HTML,
  notes: '',
  status: 'draft',
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function fmtM2(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function fmtOptionalM2(value: number | null | undefined): string {
  return value ? `${fmtM2(value)} m²` : '—';
}

function fmtMoney(value: number | null | undefined): string {
  return `${(value ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

function parseOptionalNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function displayDate(value: string): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function calculateAreas(form: EstimateForm) {
  const maxConstructionArea = form.netParcelArea != null && form.kaks != null ? form.netParcelArea * form.kaks : 0;
  const regulationBonusArea = maxConstructionArea * (form.regulationBonusPercent / 100);
  const totalBrutArea = maxConstructionArea + regulationBonusArea;
  const basementTotal = form.basementArea + form.secondBasementArea + form.thirdBasementArea;

  return {
    minBaseArea: form.netParcelArea != null && form.taksMin != null ? form.netParcelArea * form.taksMin : 0,
    maxBaseArea: form.netParcelArea != null && form.taksMax != null ? form.netParcelArea * form.taksMax : 0,
    maxConstructionArea,
    regulationBonusArea,
    totalBrutArea,
    totalWithBasement: totalBrutArea + basementTotal,
  };
}

function replaceVariables(html: string, form: EstimateForm, areas: ReturnType<typeof calculateAreas>): string {
  const values: Record<string, string> = {
    delivery_months: String(form.deliveryMonths),
    total_brut_area: fmtM2(areas.totalBrutArea),
    basement_area: fmtM2(form.basementArea),
    total_with_basement: fmtM2(areas.totalWithBasement),
    offer_valid_until: displayDate(form.offerValidUntil),
    net_area: fmtM2(form.netParcelArea),
  };

  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => values[key] ?? '');
}

function localId(): string {
  return `unit-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneUnit(unit: LocalUnit): LocalUnit {
  return { ...unit };
}

function focusTextFieldInput(event: MouseEvent<HTMLDivElement>): void {
  event.currentTarget.querySelector('input')?.focus();
}

function ownerTypeLabel(value: string): string {
  if (value === OwnerType.Contractor) return 'Mila İnşaat';
  if (value === OwnerType.Common) return 'Ortak Alan';
  return 'Tapu Sahibi';
}

function unitTypeLabel(value: string): string {
  if (value === UnitType.Shop) return 'Dükkan';
  if (value === UnitType.Common) return 'Ortak Alan';
  if (value === UnitType.Roof) return 'Çatı';
  return 'Konut';
}

function paymentUnits(units: LocalUnit[]) {
  return units.filter((unit) => unit.hasPayment !== false);
}

function roomText(room: FloorPlanRoom, keys: string[]): string | null {
  for (const key of keys) {
    const value = room[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function roomNumber(room: FloorPlanRoom, keys: string[]): number | null {
  for (const key of keys) {
    const value = room[key];
    const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function floorLabel(floorNumber: number): string {
  if (floorNumber < 0) return 'Bodrum Kat';
  if (floorNumber === 0) return 'Zemin Kat';
  return `${floorNumber}. Kat`;
}

function roomUnitType(room: FloorPlanRoom): UnitType {
  const label = [roomText(room, ['type', 'unitType', 'unit_type']), room.name, room.label, room.text]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('tr-TR');

  if (label.includes('dükkan') || label.includes('dukkan') || label.includes('shop')) return UnitType.Shop;
  if (label.includes('ortak') || label.includes('common')) return UnitType.Common;
  if (label.includes('çatı') || label.includes('cati') || label.includes('roof')) return UnitType.Roof;
  return UnitType.Apartment;
}

function unitsFromFloorPlanRooms(rooms: FloorPlanRoom[]): LocalUnit[] {
  return rooms.map((room, index) => {
    const floorNumber = Math.trunc(roomNumber(room, ['floorNumber', 'floor_number', 'floor', 'kat']) ?? 1);
    const unitNumber = Math.trunc(roomNumber(room, ['unitNumber', 'unit_number', 'apartmentNumber', 'apartment_number', 'number', 'no']) ?? index + 1);
    const unitType = roomUnitType(room);

    return {
      localId: localId(),
      floorNumber,
      floorLabel: roomText(room, ['floorLabel', 'floor_label']) ?? floorLabel(floorNumber),
      unitNumber,
      block: roomText(room, ['block', 'blok']) ?? '',
      unitType,
      ownerType: unitType === UnitType.Common ? OwnerType.Common : OwnerType.PropertyOwner,
      ownerName: unitType === UnitType.Common ? 'Ortak Alan' : '',
      propertyOwnerId: null,
      grossArea: roomNumber(room, ['grossArea', 'gross_area', 'apartmentSizeSqm', 'apartment_size_sqm', 'area', 'sqm', 'm2']),
      fireEscapeArea: roomNumber(room, ['fireEscapeArea', 'fire_escape_area']),
      hasPayment: unitType !== UnitType.Common,
      paymentAmount: null,
      notes: roomText(room, ['name', 'label', 'text']),
    };
  });
}

const noNumberSpinnerSx = {
  '& input[type=number]': {
    MozAppearance: 'textfield',
  },
  '& input[type=number]::-webkit-outer-spin-button': {
    WebkitAppearance: 'none',
    margin: 0,
  },
  '& input[type=number]::-webkit-inner-spin-button': {
    WebkitAppearance: 'none',
    margin: 0,
  },
};

export default function RoughEstimatePage() {
  const params = useParams();
  const projectId = String(params.id);

  const [activeStep, setActiveStep] = useState(0);
  const [previewTab, setPreviewTab] = useState(0);
  const [form, setForm] = useState<EstimateForm>(emptyForm);
  const [units, setUnits] = useState<LocalUnit[]>([]);
  const [groundFloorType, setGroundFloorType] = useState<GroundFloorType>('apartment');
  const [propertyOwners, setPropertyOwners] = useState<PropertyOwner[]>([]);
  const [latestFloorPlanExport, setLatestFloorPlanExport] = useState<FloorPlanExport | null>(null);
  const [estimates, setEstimates] = useState<RoughEstimate[]>([]);
  const [currentEstimateId, setCurrentEstimateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedText, setSavedText] = useState('Kaydedilmedi');
  const [dirty, setDirty] = useState(false);
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingUnitIndex, setEditingUnitIndex] = useState<number | null>(null);
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<LocalUnit | null>(null);

  const areas = useMemo(() => calculateAreas(form), [form]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: DEFAULT_OFFER_HTML,
    editorProps: {
      attributes: { class: 'rough-estimate-editor' },
    },
    onUpdate: ({ editor: activeEditor }) => {
      updateForm('offerLetterContent', activeEditor.getHTML());
    },
    immediatelyRender: false,
  });

  const markDirty = useCallback(() => {
    setDirty(true);
    setSavedText('Kaydedilmedi');
  }, []);

  const updateForm = useCallback(<K extends keyof EstimateForm>(key: K, value: EstimateForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    markDirty();
  }, [markDirty]);

  const setLoadedEstimate = useCallback((estimate: RoughEstimateWithUnits) => {
    const nextForm: EstimateForm = {
      netParcelArea: estimate.netParcelArea,
      taksMin: estimate.taksMin,
      taksMax: estimate.taksMax,
      kaks: estimate.kaks,
      regulationBonusPercent: estimate.regulationBonusPercent ?? 30,
      basementArea: estimate.basementArea ?? 0,
      secondBasementArea: estimate.secondBasementArea ?? 0,
      thirdBasementArea: estimate.thirdBasementArea ?? 0,
      floorCount: estimate.floorCount,
      unitsPerFloor: estimate.unitsPerFloor,
      hasRoofUnit: estimate.hasRoofUnit,
      roofUnitArea: estimate.roofUnitArea ?? 0,
      totalConstructionCost: estimate.totalConstructionCost,
      currency: estimate.currency,
      usdRate: estimate.usdRate,
      projectTitle: estimate.projectTitle ?? '',
      offerValidUntil: estimate.offerValidUntil ?? '',
      deliveryMonths: estimate.deliveryMonths,
      offerLetterTitle: estimate.offerLetterTitle ?? DEFAULT_OFFER_TITLE,
      offerLetterContent: estimate.offerLetterContent ?? DEFAULT_OFFER_HTML,
      notes: estimate.notes ?? '',
      status: estimate.status,
    };

    setCurrentEstimateId(estimate.id);
    setForm(nextForm);
    setUnits(estimate.units.map((unit) => ({ ...unit, localId: unit.id })));
    editor?.commands.setContent(nextForm.offerLetterContent, { emitUpdate: false });
    setDirty(false);
    setSavedText('Kaydedildi');
  }, [editor]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const [project, latestArea, owners, previous, latestFloorPlan] = await Promise.all([
          getProjectApi(projectId),
          getLatestAreaCalculationApi(projectId).catch(() => null),
          getPropertyOwnersApi(projectId).catch(() => []),
          getRoughEstimatesApi(projectId),
          getLatestFloorPlanExportApi(projectId).catch(() => null),
        ]);

        if (!mounted) return;
        setPropertyOwners(owners);
        setLatestFloorPlanExport(latestFloorPlan);
        setEstimates(previous);
        const results = latestArea?.calculatedResults;
        const extracted = latestArea?.extractedData;
        setForm((current) => ({
          ...current,
          projectTitle: project.name,
          offerValidUntil: current.offerValidUntil || todayIso(),
          netParcelArea: results?.net_alan ?? results?.net_area_calculated ?? current.netParcelArea,
          taksMin: results?.taks_min ?? toNumber(extracted?.zoning?.taks_min) ?? current.taksMin,
          taksMax: results?.taks_max ?? toNumber(extracted?.zoning?.taks_max) ?? current.taksMax,
          kaks: results?.kaks ?? toNumber(extracted?.zoning?.kaks) ?? current.kaks,
          floorCount: results?.kat_adedi ?? results?.floor_count ?? current.floorCount,
          basementArea: results?.bodrum_alani ?? 0,
        }));
      } catch {
        if (mounted) setError('Kaba hesap verileri yüklenemedi.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => { mounted = false; };
  }, [projectId]);

  const buildPayload = useCallback((): RoughEstimatePayload & { units: RoughEstimateUnitPayload[] } => ({
    ...form,
    minBaseArea: areas.minBaseArea,
    maxBaseArea: areas.maxBaseArea,
    maxConstructionArea: areas.maxConstructionArea,
    regulationBonusArea: areas.regulationBonusArea,
    totalBrutArea: areas.totalBrutArea,
    costPerSqm: form.totalConstructionCost && areas.totalBrutArea ? form.totalConstructionCost / areas.totalBrutArea : null,
    units: units.map(({ localId: _localId, ...unit }) => unit),
  }), [areas, form, units]);

  const refreshEstimates = useCallback(async () => {
    setEstimates(await getRoughEstimatesApi(projectId));
  }, [projectId]);

  const saveDraft = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setSavedText('Kaydediliyor...');
    try {
      const payload = buildPayload();
      const saved = currentEstimateId
        ? await updateRoughEstimateApi(currentEstimateId, payload)
        : await createRoughEstimateApi(projectId, payload);
      setCurrentEstimateId(saved.id);
      setUnits(saved.units.map((unit) => ({ ...unit, localId: unit.id })));
      setDirty(false);
      setSavedText('Kaydedildi');
      await refreshEstimates();
    } catch {
      setSavedText('Kaydedilemedi');
      setError('Kaba hesap kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }, [buildPayload, currentEstimateId, projectId, refreshEstimates, saving]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (dirty && !saving) void saveDraft();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [dirty, saveDraft, saving]);

  function generateRows() {
    const generated: LocalUnit[] = [];
    generated.push({
      localId: localId(),
      floorNumber: -1,
      floorLabel: 'Bodrum Kat',
      unitNumber: 1,
      block: '',
      unitType: UnitType.Common,
      ownerType: OwnerType.Common,
      ownerName: 'Ortak Alan',
      grossArea: null,
      fireEscapeArea: null,
      hasPayment: false,
      paymentAmount: null,
    });

    for (let no = 1; no <= form.unitsPerFloor; no += 1) {
      const unitType = groundFloorType === 'shop' || (groundFloorType === 'mixed' && no === 1) ? UnitType.Shop : UnitType.Apartment;
      generated.push({
        localId: localId(),
        floorNumber: 0,
        floorLabel: 'Zemin Kat',
        unitNumber: no,
        block: '',
        unitType,
        ownerType: OwnerType.PropertyOwner,
        ownerName: propertyOwners[no - 1]?.name ?? '',
        propertyOwnerId: propertyOwners[no - 1]?.id ?? null,
        grossArea: null,
        fireEscapeArea: null,
        hasPayment: true,
        paymentAmount: null,
      });
    }

    for (let floor = 1; floor <= form.floorCount; floor += 1) {
      for (let no = 1; no <= form.unitsPerFloor; no += 1) {
        const ownerIndex = ((floor - 1) * form.unitsPerFloor + no - 1) % Math.max(propertyOwners.length, 1);
        generated.push({
          localId: localId(),
          floorNumber: floor,
          floorLabel: `${floor}. Kat`,
          unitNumber: no,
          block: '',
          unitType: UnitType.Apartment,
          ownerType: OwnerType.PropertyOwner,
          ownerName: propertyOwners[ownerIndex]?.name ?? '',
          propertyOwnerId: propertyOwners[ownerIndex]?.id ?? null,
          grossArea: null,
          fireEscapeArea: null,
          hasPayment: true,
          paymentAmount: null,
        });
      }
    }

    if (form.hasRoofUnit) {
      generated.push({
        localId: localId(),
        floorNumber: form.floorCount + 1,
        floorLabel: 'Çatı Piyesi',
        unitNumber: 1,
        block: '',
        unitType: UnitType.Roof,
        ownerType: OwnerType.Contractor,
        ownerName: 'Mila İnşaat',
        grossArea: null,
        fireEscapeArea: null,
        hasPayment: false,
        paymentAmount: null,
      });
    }

    setUnits(generated);
    markDirty();
  }

  async function importUnitsFromFloorPlan() {
    try {
      const floorPlanExport = await getLatestFloorPlanExportApi(projectId);
      setLatestFloorPlanExport(floorPlanExport);
      const rooms = floorPlanExport?.planMetadata?.rooms ?? [];

      if (rooms.length === 0) {
        setError('Kat planı verisi bulunamadı, manuel giriş yapın');
        return;
      }

      const generated = unitsFromFloorPlanRooms(rooms);
      if (generated.length === 0) {
        setError('Kat planı verisi bulunamadı, manuel giriş yapın');
        return;
      }

      const normalFloors = generated
        .map((unit) => unit.floorNumber)
        .filter((floorNumber) => floorNumber > 0);
      const unitsPerFloor = generated.reduce<Record<number, number>>((acc, unit) => {
        if (unit.floorNumber >= 0 && unit.unitType !== UnitType.Common) {
          acc[unit.floorNumber] = (acc[unit.floorNumber] ?? 0) + 1;
        }
        return acc;
      }, {});
      const nextFloorCount = Math.max(...normalFloors, floorPlanExport?.planMetadata?.floor_count ?? 0, 1);
      const nextUnitsPerFloor = Math.max(...Object.values(unitsPerFloor), 1);

      setUnits(generated);
      setForm((current) => ({
        ...current,
        floorCount: nextFloorCount,
        unitsPerFloor: nextUnitsPerFloor,
      }));
      markDirty();
      setSuccess(`${generated.length} birim kat planından alındı`);
    } catch {
      setError('Kat planı verisi alınamadı.');
    }
  }

  async function transferUnitsToPropertyOwners() {
    const existingUnits = new Set(
      propertyOwners
        .filter((owner) => owner.floorNumber !== null && owner.apartmentNumber)
        .map((owner) => `${owner.floorNumber}:${owner.apartmentNumber}`),
    );
    const queuedUnits = new Set<string>();
    const owners = units
      .filter((unit) => unit.ownerType === OwnerType.PropertyOwner && Boolean(unit.ownerName?.trim()))
      .filter((unit) => {
        const key = `${unit.floorNumber}:${unit.unitNumber}`;
        if (existingUnits.has(key) || queuedUnits.has(key)) {
          return false;
        }
        queuedUnits.add(key);
        return true;
      })
      .map((unit) => ({
        name: unit.ownerName!.trim(),
        floor_number: unit.floorNumber,
        apartment_number: String(unit.unitNumber),
        apartment_size_sqm: unit.grossArea ?? null,
        notes: 'Kaba hesaptan aktarıldı',
      }));

    if (owners.length === 0) {
      setSuccess('0 tapu sahibi eklendi');
      return;
    }

    try {
      const created = await bulkUpsertPropertyOwnersApi(projectId, owners);
      setPropertyOwners(await getPropertyOwnersApi(projectId));
      setSuccess(`${created.length} tapu sahibi eklendi`);
    } catch {
      setError('Tapu sahiplerine aktarılamadı.');
    }
  }

  function openUnitDialog(index: number | null) {
    if (index === null) {
      setEditingUnitIndex(null);
      setEditingUnit({
        localId: localId(),
        floorNumber: 1,
        floorLabel: '1. Kat',
        unitNumber: units.length + 1,
        block: '',
        unitType: UnitType.Apartment,
        ownerType: OwnerType.PropertyOwner,
        ownerName: '',
        propertyOwnerId: null,
        grossArea: null,
        fireEscapeArea: null,
        hasPayment: true,
        paymentAmount: null,
        notes: '',
      });
      setUnitDialogOpen(true);
      return;
    }

    setEditingUnitIndex(index);
    setEditingUnit(cloneUnit(units[index]!));
    setUnitDialogOpen(true);
  }

  function closeUnitDialog() {
    setUnitDialogOpen(false);
    setEditingUnitIndex(null);
    setEditingUnit(null);
  }

  function saveUnitDialog() {
    if (!editingUnit) return;
    const normalizedUnit = editingUnit.hasPayment === false ? { ...editingUnit, paymentAmount: null } : cloneUnit(editingUnit);

    if (editingUnitIndex === null) {
      setUnits((current) => [...current, normalizedUnit]);
    } else {
      setUnits((current) => current.map((unit, index) => index === editingUnitIndex ? normalizedUnit : unit));
    }

    markDirty();
    closeUnitDialog();
  }

  async function copyVariable(variable: string) {
    await navigator.clipboard.writeText(variable);
    setCopiedVariable(variable);
    window.setTimeout(() => setCopiedVariable(null), 1200);
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ pb: 8 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Kaba Hesap ve Teklif</Typography>
          <Typography variant="body2" color="text.secondary">Emsal hesabı, kat maliklerine ödeme dağılımı ve teklif mektubu</Typography>
        </Box>
        <Chip label={saving ? 'Kaydediliyor...' : savedText} color={savedText === 'Kaydedildi' ? 'success' : 'default'} />
      </Box>

      <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
        {steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
      </Stepper>

      {activeStep === 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '420px 1fr' }, gap: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ display: 'grid', gap: 2 }}>
              <Typography fontWeight={800}>Alan Hesabı</Typography>
              <NumberField label="Net Parsel Alanı (m²)" value={form.netParcelArea} onChange={(v) => updateForm('netParcelArea', v)} />
              <NumberField label="TAKS Min" value={form.taksMin} onChange={(v) => updateForm('taksMin', v)} />
              <NumberField label="TAKS Max" value={form.taksMax} onChange={(v) => updateForm('taksMax', v)} />
              <NumberField label="KAKS" value={form.kaks} onChange={(v) => updateForm('kaks', v)} />
              <NumberField label="Yönetmelik Kazanım %" value={form.regulationBonusPercent} onChange={(v) => updateForm('regulationBonusPercent', v ?? 30)} />
              <NumberField label="1. Bodrum Kat Alanı (m²)" value={form.basementArea} onChange={(v) => updateForm('basementArea', v ?? 0)} />
              <NumberField label="2. Bodrum Kat Alanı (m²)" value={form.secondBasementArea} onChange={(v) => updateForm('secondBasementArea', v ?? 0)} />
              <NumberField label="3. Bodrum Kat Alanı (m²)" value={form.thirdBasementArea} onChange={(v) => updateForm('thirdBasementArea', v ?? 0)} />
            </CardContent>
          </Card>
          <Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
              <MetricCard label="Min Taban Alanı" value={`${fmtM2(areas.minBaseArea)} m²`} color="#0ea5e9" />
              <MetricCard label="Max Taban Alanı" value={`${fmtM2(areas.maxBaseArea)} m²`} color="#0ea5e9" />
              <MetricCard label="Max İnşaat Alanı" value={`${fmtM2(areas.maxConstructionArea)} m²`} color="#f59e0b" />
              <MetricCard label="Yönetmelik Kazanımı" value={`${fmtM2(areas.regulationBonusArea)} m²`} color="#f59e0b" />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2, mt: 2 }}>
              <MetricCard large label="Toplam Brüt Alan (Bodrum Hariç)" value={`${fmtM2(areas.totalBrutArea)} m²`} color="#16a34a" />
              <MetricCard large label="Genel Toplam (Bodrum Dahil)" value={`${fmtM2(areas.totalWithBasement)} m²`} color="#16a34a" />
            </Box>
          </Box>
        </Box>
      )}

      {activeStep === 1 && (
        <Box>
          <Paper variant="outlined" sx={{ p: 2, mb: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(5, 1fr)' }, gap: 2, alignItems: 'center' }}>
            <NumberField label="Normal Kat Sayısı" value={form.floorCount} min={1} onChange={(v) => updateForm('floorCount', Math.max(1, Math.trunc(v ?? 1)))} />
            <NumberField label="Her Katta Daire Sayısı" value={form.unitsPerFloor} min={1} onChange={(v) => updateForm('unitsPerFloor', Math.max(1, Math.trunc(v ?? 1)))} />
            <TextField select label="Zemin Kat Tipi" value={groundFloorType} onChange={(e) => setGroundFloorType(e.target.value as GroundFloorType)}>
              <MenuItem value="apartment">Konut</MenuItem>
              <MenuItem value="shop">Dükkan</MenuItem>
              <MenuItem value="mixed">Karışık</MenuItem>
            </TextField>
            <FormControlLabel control={<Switch checked={form.hasRoofUnit} onChange={(e) => updateForm('hasRoofUnit', e.target.checked)} />} label="Çatı Piyesi" />
            <Button variant="contained" onClick={generateRows}>Tablo Oluştur</Button>
            {latestFloorPlanExport && (
              <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => void importUnitsFromFloorPlan()}>
                Kat Planından Al
              </Button>
            )}
            {form.hasRoofUnit && <NumberField label="Çatı Piyesi Alanı (m²)" value={form.roofUnitArea} onChange={(v) => updateForm('roofUnitArea', v ?? 0)} />}
          </Paper>
          <UnitsSummaryTable units={units} onEdit={openUnitDialog} />
          <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button startIcon={<AddIcon />} onClick={() => openUnitDialog(null)}>
              Satır Ekle
            </Button>
            <Button variant="outlined" startIcon={<SaveIcon />} onClick={() => void transferUnitsToPropertyOwners()}>
              Tapu Sahiplerine Aktar
            </Button>
          </Box>
          <Paper variant="outlined" sx={{ mt: 2, p: 2, display: 'flex', gap: 4 }}>
            <Typography><strong>Toplam Alan:</strong> {fmtM2(units.reduce((sum, unit) => sum + (unit.grossArea ?? 0), 0))} m²</Typography>
            <Typography><strong>Ödeme Yapacak Daire Sayısı:</strong> {paymentUnits(units).length}</Typography>
          </Paper>
        </Box>
      )}

      {activeStep === 2 && (
        <Box sx={{ display: 'grid', gap: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
              <Typography sx={{ gridColumn: '1 / -1' }} fontWeight={800}>Maliyet</Typography>
              <NumberField label="Toplam İnşaat Maliyeti (₺)" value={form.totalConstructionCost} onChange={(v) => updateForm('totalConstructionCost', v)} />
              <NumberField label="TCMB Kuru" value={form.usdRate} onChange={(v) => updateForm('usdRate', v)} />
              <NumberField label="Teslim Süresi (ay)" value={form.deliveryMonths} onChange={(v) => updateForm('deliveryMonths', Math.max(1, Math.trunc(v ?? 10)))} />
              <TextField label="Teklif Geçerlilik Tarihi" type="date" value={form.offerValidUntil} onChange={(e) => updateForm('offerValidUntil', e.target.value)} InputLabelProps={{ shrink: true }} />
              <TextField sx={{ gridColumn: '1 / -1' }} label="Proje Başlığı / Adres" multiline minRows={3} value={form.projectTitle} onChange={(e) => updateForm('projectTitle', e.target.value)} />
              <PaymentSummaryCard units={units} />
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography fontWeight={800} sx={{ mb: 2 }}>Teklif Mektubu İçeriği</Typography>
              <TextField fullWidth label="Teklif Başlığı" value={form.offerLetterTitle} onChange={(e) => updateForm('offerLetterTitle', e.target.value)} sx={{ mb: 2 }} />
              <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                <EditorToolbar editor={editor} />
                <Box
                  sx={{
                    bgcolor: 'white',
                    p: 3,
                    minHeight: 400,
                    borderTop: '1px solid #ddd',
                    '& .rough-estimate-editor': {
                      minHeight: 360,
                      outline: 'none',
                      fontFamily: 'Arial, sans-serif',
                      color: '#111827',
                      '& h1': { fontSize: 28 },
                      '& h2': { fontSize: 22 },
                      '& h3': { fontSize: 18 },
                    },
                  }}
                >
                  <EditorContent editor={editor} />
                </Box>
              </Paper>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>Kullanılabilir Değişkenler:</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {templateVariables.map(([variable, label]) => (
                    <Tooltip key={variable} title={copiedVariable === variable ? 'Kopyalandı' : label}>
                      <Chip label={variable} onClick={() => void copyVariable(variable)} variant="outlined" />
                    </Tooltip>
                  ))}
                </Box>
                <Button sx={{ mt: 2 }} color="warning" startIcon={<RestartAltIcon />} onClick={() => setResetOpen(true)}>
                  Şablonu Sıfırla
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {activeStep === 3 && (
        <Box>
          <Tabs value={previewTab} onChange={(_e, value: number) => setPreviewTab(value)} sx={{ mb: 2 }}>
            <Tab label="Hesap Tablosu" />
            <Tab label="Teklif Mektubu" />
            <Tab label="Paylaşım Krokisi" />
          </Tabs>
          {previewTab === 0 && <CalculationPreview form={form} areas={areas} units={units} />}
          {previewTab === 1 && <OfferPreview form={form} areas={areas} html={replaceVariables(form.offerLetterContent, form, areas)} />}
          {previewTab === 2 && <BuildingDiagram form={form} units={units} />}
        </Box>
      )}

      <Paper elevation={3} sx={{ position: 'sticky', bottom: 0, mt: 3, p: 2, display: 'flex', justifyContent: 'space-between', gap: 2, zIndex: 5 }}>
        <Button disabled={activeStep === 0} onClick={() => setActiveStep((s) => Math.max(0, s - 1))}>← Geri Dön</Button>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {activeStep < 3 ? (
            <Button variant="contained" onClick={() => setActiveStep((s) => Math.min(3, s + 1))}>Devam</Button>
          ) : (
            <>
              <Button variant="outlined" startIcon={<SaveIcon />} disabled={saving} onClick={() => void saveDraft()}>Kaydet</Button>
              <Button variant="outlined" startIcon={<DownloadIcon />} disabled={!currentEstimateId} onClick={() => currentEstimateId && void downloadRoughEstimateExcelApi(currentEstimateId)}>Excel İndir</Button>
              <Button variant="contained" color="success" startIcon={<DownloadIcon />} disabled={!currentEstimateId} onClick={() => currentEstimateId && void downloadRoughEstimatePdfApi(currentEstimateId)}>PDF İndir</Button>
            </>
          )}
        </Box>
      </Paper>

      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>Önceki Hesaplar</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }, gap: 2 }}>
          {estimates.map((estimate) => (
            <Card key={estimate.id} variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <Typography fontWeight={800}>{estimate.projectTitle || 'Kaba Hesap'}</Typography>
                  <Chip label={estimate.status} size="small" />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{new Date(estimate.createdAt).toLocaleDateString('tr-TR')}</Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                  <Button size="small" onClick={async () => setLoadedEstimate(await getRoughEstimateApi(estimate.id))}>Yükle</Button>
                  <Button size="small" onClick={() => void downloadRoughEstimatePdfApi(estimate.id)}>PDF</Button>
                  <Button size="small" onClick={() => void downloadRoughEstimateExcelApi(estimate.id)}>Excel</Button>
                  <IconButton size="small" color="error" onClick={async () => { await deleteRoughEstimateApi(estimate.id); await refreshEstimates(); }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          ))}
          {estimates.length === 0 && <Typography color="text.secondary">Henüz önceki hesap yok.</Typography>}
        </Box>
      </Box>

      <UnitEditDialog
        open={unitDialogOpen}
        editingUnit={editingUnit}
        propertyOwners={propertyOwners}
        title={editingUnitIndex === null ? 'Daire Ekle' : 'Daire Düzenle'}
        onChange={setEditingUnit}
        onClose={closeUnitDialog}
        onSave={saveUnitDialog}
      />

      <Dialog open={resetOpen} onClose={() => setResetOpen(false)}>
        <DialogTitle>Şablonu sıfırla?</DialogTitle>
        <DialogContent>Teklif mektubu içeriği varsayılan şablonla değiştirilecek.</DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)}>Vazgeç</Button>
          <Button color="warning" onClick={() => { updateForm('offerLetterContent', DEFAULT_OFFER_HTML); editor?.commands.setContent(DEFAULT_OFFER_HTML, { emitUpdate: false }); setResetOpen(false); }}>Sıfırla</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!error} autoHideDuration={5000} onClose={() => setError(null)}>
        <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>
      </Snackbar>
      <Snackbar open={!!success} autoHideDuration={4000} onClose={() => setSuccess(null)}>
        <Alert severity="success" onClose={() => setSuccess(null)}>{success}</Alert>
      </Snackbar>
    </Box>
  );
}

function NumberField({ label, value, onChange, min }: { label: string; value: number | null; onChange: (value: number | null) => void; min?: number }) {
  return (
    <TextField
      label={label}
      type="number"
      value={value ?? ''}
      onChange={(e) => onChange(toNumber(e.target.value))}
      inputProps={{ min, step: 'any' }}
      fullWidth
      sx={{
        '& input[type=number]': {
          MozAppearance: 'textfield',
        },
        '& input[type=number]::-webkit-outer-spin-button': {
          WebkitAppearance: 'none',
          margin: 0,
        },
        '& input[type=number]::-webkit-inner-spin-button': {
          WebkitAppearance: 'none',
          margin: 0,
        },
      }}
    />
  );
}

function MetricCard({ label, value, color, large = false }: { label: string; value: string; color: string; large?: boolean }) {
  return (
    <Card variant="outlined" sx={{ borderLeft: `5px solid ${color}` }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography sx={{ color, fontSize: large ? 28 : 22, fontWeight: 900, mt: 1 }}>{value}</Typography>
      </CardContent>
    </Card>
  );
}

function UnitsSummaryTable({ units, onEdit }: { units: LocalUnit[]; onEdit: (index: number) => void }) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          {['Kat', 'No', 'Nitelik', 'Brüt Alan (m²)', 'Sahip Tipi', 'Sahip Adı', 'Ödeme Tutarı', 'Düzenle'].map((header) => (
            <TableCell key={header}>{header}</TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {units.map((unit, index) => (
          <TableRow key={unit.localId} hover>
            <TableCell>{unit.floorLabel ?? `${unit.floorNumber}. Kat`}</TableCell>
            <TableCell>{unit.unitNumber}</TableCell>
            <TableCell>{unitTypeLabel(unit.unitType ?? UnitType.Apartment)}</TableCell>
            <TableCell>{fmtOptionalM2(unit.grossArea)}</TableCell>
            <TableCell>{ownerTypeLabel(unit.ownerType ?? OwnerType.PropertyOwner)}</TableCell>
            <TableCell>{unit.ownerName || '-'}</TableCell>
            <TableCell>{unit.hasPayment ? fmtMoney(unit.paymentAmount) : 'Ödeme yok'}</TableCell>
            <TableCell>
              <IconButton size="small" color="primary" onClick={() => onEdit(index)} aria-label="Daire düzenle">
                <EditIcon fontSize="small" />
              </IconButton>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function UnitEditDialog({ open, editingUnit, propertyOwners, title, onChange, onClose, onSave }: {
  open: boolean;
  editingUnit: LocalUnit | null;
  propertyOwners: PropertyOwner[];
  title: string;
  onChange: (unit: LocalUnit | null) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const patchUnit = (patch: Partial<LocalUnit>) => {
    if (!editingUnit) return;
    const next = { ...editingUnit, ...patch };
    if (patch.ownerType === OwnerType.Contractor || patch.ownerType === OwnerType.Common) {
      next.hasPayment = false;
      next.paymentAmount = null;
    }
    onChange(next);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: 500, maxWidth: 'calc(100vw - 32px)' } }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
        <TextField
          label="Kat"
          value={editingUnit?.floorLabel ?? ''}
          onChange={(e) => patchUnit({ floorLabel: e.target.value })}
          onClick={focusTextFieldInput}
          size="small"
        />
        <TextField
          label="No"
          value={editingUnit?.unitNumber ?? ''}
          onChange={(e) => patchUnit({ unitNumber: Math.trunc(parseFloat(e.target.value) || 0) })}
          size="small"
        />
        <TextField
          select
          label="Nitelik"
          value={editingUnit?.unitType ?? UnitType.Apartment}
          onChange={(e) => patchUnit({ unitType: e.target.value })}
          size="small"
        >
          <MenuItem value={UnitType.Apartment}>Konut</MenuItem>
          <MenuItem value={UnitType.Shop}>Dükkan</MenuItem>
          <MenuItem value={UnitType.Common}>Ortak Alan</MenuItem>
        </TextField>
        <TextField
          type="number"
          label="Brüt Alan (m²)"
          value={editingUnit?.grossArea || ''}
          onChange={(e) => patchUnit({ grossArea: parseOptionalNumber(e.target.value) })}
          size="small"
          inputProps={{ min: 0, step: 0.01 }}
          sx={noNumberSpinnerSx}
        />
        <TextField
          type="number"
          label="Yangın Merdiveni Alanı (m²)"
          value={editingUnit?.fireEscapeArea || ''}
          onChange={(e) => patchUnit({ fireEscapeArea: parseOptionalNumber(e.target.value) })}
          size="small"
          inputProps={{ min: 0, step: 0.01 }}
          sx={noNumberSpinnerSx}
        />
        <TextField
          select
          label="Sahip Tipi"
          value={editingUnit?.ownerType ?? OwnerType.PropertyOwner}
          onChange={(e) => patchUnit({ ownerType: e.target.value })}
          size="small"
        >
          <MenuItem value={OwnerType.PropertyOwner}>Tapu Sahibi</MenuItem>
          <MenuItem value={OwnerType.Contractor}>Mila İnşaat</MenuItem>
          <MenuItem value={OwnerType.Common}>Ortak Alan</MenuItem>
        </TextField>
        <TextField
          label="Sahip Adı"
          value={editingUnit?.ownerName ?? ''}
          onChange={(e) => {
            const owner = propertyOwners.find((candidate) => candidate.name === e.target.value);
            patchUnit({ ownerName: e.target.value, propertyOwnerId: owner?.id ?? editingUnit?.propertyOwnerId ?? null });
          }}
          inputProps={{ list: 'rough-estimate-owner-list' }}
          size="small"
        />
        <datalist id="rough-estimate-owner-list">
          {propertyOwners.map((owner) => <option key={owner.id} value={owner.name} />)}
        </datalist>
        <FormControlLabel
          control={<Switch checked={editingUnit?.hasPayment !== false} onChange={(e) => patchUnit({ hasPayment: e.target.checked, paymentAmount: e.target.checked ? editingUnit?.paymentAmount ?? null : null })} />}
          label="Ödeme Var mı?"
        />
        {editingUnit?.hasPayment !== false && (
          <TextField
            type="number"
            label="Ödeme Tutarı (₺)"
            value={editingUnit?.paymentAmount || ''}
            onChange={(e) => patchUnit({ paymentAmount: parseOptionalNumber(e.target.value) })}
            size="small"
            inputProps={{ min: 0, step: 0.01 }}
            sx={noNumberSpinnerSx}
          />
        )}
        <TextField
          label="Notlar"
          value={editingUnit?.notes ?? ''}
          onChange={(e) => patchUnit({ notes: e.target.value })}
          multiline
          rows={2}
          size="small"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" onClick={onClose}>İptal</Button>
        <Button variant="contained" color="success" onClick={onSave}>Kaydet</Button>
      </DialogActions>
    </Dialog>
  );
}

function PaymentSummaryCard({ units }: { units: LocalUnit[] }) {
  const rows = units.filter((unit) => unit.hasPayment !== false);
  const total = rows.reduce((sum, unit) => sum + (unit.paymentAmount ?? 0), 0);

  return (
    <Paper variant="outlined" sx={{ gridColumn: '1 / -1', p: 2 }}>
      <Typography fontWeight={800} sx={{ mb: 1 }}>Ödeme Özeti</Typography>
      <Table size="small">
        <TableHead><TableRow><TableCell>Daire</TableCell><TableCell>Sahip</TableCell><TableCell align="right">Ödeme Tutarı</TableCell></TableRow></TableHead>
        <TableBody>
          {rows.map((unit) => (
            <TableRow key={unit.localId}>
              <TableCell>{unit.floorLabel ?? `${unit.floorNumber}. Kat`} / No: {unit.unitNumber}</TableCell>
              <TableCell>{unit.ownerName || ownerTypeLabel(unit.ownerType ?? OwnerType.PropertyOwner)}</TableCell>
              <TableCell align="right">{fmtMoney(unit.paymentAmount)}</TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell><strong>Toplam</strong></TableCell>
            <TableCell />
            <TableCell align="right"><strong>{fmtMoney(total)}</strong></TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Ödeme tutarları daire düzenleme ekranından girilir
      </Typography>
    </Paper>
  );
}

function PaymentPreview({ units }: { units: LocalUnit[] }) {
  const rows = paymentUnits(units);
  const total = rows.reduce((sum, unit) => sum + (unit.paymentAmount ?? 0), 0);
  return (
    <Box sx={{ gridColumn: '1 / -1' }}>
      <Table size="small">
        <TableHead><TableRow><TableCell>Ödeme yapacak daireler</TableCell><TableCell>Alan</TableCell><TableCell align="right">Ödeme Tutarı</TableCell></TableRow></TableHead>
        <TableBody>
          {rows.map((unit) => (
            <TableRow key={unit.localId}><TableCell>{unit.ownerName || `${unit.floorLabel} / ${unit.unitNumber}`}</TableCell><TableCell>{fmtM2(unit.grossArea)} m²</TableCell><TableCell align="right">{fmtMoney(unit.paymentAmount)}</TableCell></TableRow>
          ))}
          <TableRow><TableCell><strong>Toplam</strong></TableCell><TableCell /><TableCell align="right"><strong>{fmtMoney(total)}</strong></TableCell></TableRow>
        </TableBody>
      </Table>
    </Box>
  );
}

function EditorToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  const button = (label: string, icon: ReactNode, action: () => void, active = false) => (
    <Tooltip title={label}>
      <IconButton size="small" color={active ? 'primary' : 'default'} onClick={action}>{icon}</IconButton>
    </Tooltip>
  );

  return (
    <Paper square elevation={0} sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: '#f5f5f5', borderBottom: '1px solid #ddd', p: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
      {button('Bold', <FormatBoldIcon />, () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
      {button('Italic', <FormatItalicIcon />, () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
      {button('Underline', <FormatUnderlinedIcon />, () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'))}
      <Divider flexItem orientation="vertical" />
      {button('H1', <TitleIcon />, () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive('heading', { level: 1 }))}
      {button('H2', <strong>H2</strong>, () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }))}
      {button('H3', <strong>H3</strong>, () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }))}
      <Divider flexItem orientation="vertical" />
      {button('Bullet list', <FormatListBulletedIcon />, () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
      {button('Ordered list', <FormatListNumberedIcon />, () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
      <Divider flexItem orientation="vertical" />
      {button('Align left', <FormatAlignLeftIcon />, () => editor.chain().focus().setTextAlign('left').run(), editor.isActive({ textAlign: 'left' }))}
      {button('Align center', <FormatAlignCenterIcon />, () => editor.chain().focus().setTextAlign('center').run(), editor.isActive({ textAlign: 'center' }))}
      {button('Align right', <FormatAlignRightIcon />, () => editor.chain().focus().setTextAlign('right').run(), editor.isActive({ textAlign: 'right' }))}
      <Divider flexItem orientation="vertical" />
      {button('Undo', <UndoIcon />, () => editor.chain().focus().undo().run())}
      {button('Redo', <RedoIcon />, () => editor.chain().focus().redo().run())}
    </Paper>
  );
}

function CalculationPreview({ form, areas, units }: { form: EstimateForm; areas: ReturnType<typeof calculateAreas>; units: LocalUnit[] }) {
  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Table size="small">
        <TableHead><TableRow><TableCell>Açıklama</TableCell><TableCell>Oran</TableCell><TableCell>Net Alan</TableCell><TableCell>Sonuç</TableCell></TableRow></TableHead>
        <TableBody>
          <TableRow><TableCell>Minimum Taban Alanı</TableCell><TableCell>{form.taksMin}</TableCell><TableCell>{fmtM2(form.netParcelArea)}</TableCell><TableCell>{fmtM2(areas.minBaseArea)}</TableCell></TableRow>
          <TableRow><TableCell>Maksimum Taban Alanı</TableCell><TableCell>{form.taksMax}</TableCell><TableCell>{fmtM2(form.netParcelArea)}</TableCell><TableCell>{fmtM2(areas.maxBaseArea)}</TableCell></TableRow>
          <TableRow><TableCell>Maksimum İnşaat Alanı</TableCell><TableCell>{form.kaks}</TableCell><TableCell>{fmtM2(form.netParcelArea)}</TableCell><TableCell>{fmtM2(areas.maxConstructionArea)}</TableCell></TableRow>
          <TableRow><TableCell>Yönetmelikten Kazanılan Alan %{form.regulationBonusPercent}</TableCell><TableCell /><TableCell /><TableCell>{fmtM2(areas.regulationBonusArea)}</TableCell></TableRow>
          <TableRow><TableCell><strong>Toplam Brüt İnşaat Alanı</strong></TableCell><TableCell /><TableCell /><TableCell><strong>{fmtM2(areas.totalBrutArea)}</strong></TableCell></TableRow>
        </TableBody>
      </Table>
      <PaymentPreview units={units} />
    </Box>
  );
}

function OfferPreview({ form, html }: { form: EstimateForm; areas: ReturnType<typeof calculateAreas>; html: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 4, bgcolor: '#fff' }}>
      <Typography align="center" fontWeight={900}>MİLA İNŞAAT</Typography>
      <Typography align="center" sx={{ mb: 2 }}>{form.projectTitle}</Typography>
      <Typography align="center" fontWeight={900} sx={{ mb: 1 }}>{form.offerLetterTitle}</Typography>
      <Typography align="right" variant="body2">{displayDate(todayIso())}</Typography>
      <Box sx={{ mt: 3, '& p': { lineHeight: 1.7 } }} dangerouslySetInnerHTML={{ __html: html }} />
      <Divider sx={{ my: 3 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
        <Typography whiteSpace="pre-line">TCMB Efektif Döviz Satış Kuru{'\n'}1 Dolar (USD): {form.usdRate ?? 0} TL</Typography>
        <Typography textAlign="right" whiteSpace="pre-line" fontWeight={700}>İhsan Safa OSMANLIOĞLU{'\n'}İnşaat Yüksek Mühendisi{'\n'}İnşaat Proje Sorumlusu</Typography>
      </Box>
    </Paper>
  );
}

function BuildingDiagram({ form, units }: { form: EstimateForm; units: LocalUnit[] }) {
  const grouped = [...units].sort((a, b) => b.floorNumber - a.floorNumber || a.unitNumber - b.unitNumber).reduce<Map<number, LocalUnit[]>>((map, unit) => {
    map.set(unit.floorNumber, [...(map.get(unit.floorNumber) ?? []), unit]);
    return map;
  }, new Map());
  const floors = Array.from(grouped.entries());
  const width = 760;
  const floorHeight = 82;
  const height = Math.max(180, floors.length * floorHeight + 80);

  return (
    <Paper variant="outlined" sx={{ p: 2, overflow: 'auto' }}>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Kat malikleri paylaşım krokisi">
        <text x={width / 2} y="24" textAnchor="middle" fontWeight="800" fontSize="16">{form.projectTitle}</text>
        <text x={width / 2} y="44" textAnchor="middle" fontWeight="800" fontSize="13">KAT MALİKLERİ PAYLAŞIM KROKİSİ</text>
        {floors.map(([floor, floorUnits], floorIndex) => {
          const y = 64 + floorIndex * floorHeight;
          const cellWidth = 620 / Math.max(floorUnits.length, 1);
          return (
            <g key={floor}>
              {floorUnits.map((unit, index) => {
                const contractor = unit.ownerType === OwnerType.Contractor;
                const common = unit.ownerType === OwnerType.Common;
                const fill = contractor ? '#1976d2' : common ? '#f5f5f5' : '#e3f2fd';
                const text = contractor ? '#ffffff' : '#111827';
                return (
                  <g key={unit.localId}>
                    <rect x={40 + index * cellWidth} y={y} width={cellWidth} height={floorHeight} fill={fill} stroke="#64748b" />
                    <text x={40 + index * cellWidth + cellWidth / 2} y={y + 22} textAnchor="middle" fill={text} fontWeight="700" fontSize="11">{unit.ownerName || ownerTypeLabel(unit.ownerType ?? '')}</text>
                    <text x={40 + index * cellWidth + cellWidth / 2} y={y + 42} textAnchor="middle" fill={text} fontSize="10">Brüt: {fmtM2(unit.grossArea)} m²</text>
                    <text x={40 + index * cellWidth + cellWidth / 2} y={y + 60} textAnchor="middle" fill={text} fontSize="10">{unit.hasPayment ? `Ödeme: ${fmtMoney(unit.paymentAmount)}` : 'Ödeme yok.'}</text>
                  </g>
                );
              })}
              <text x="680" y={y + floorHeight / 2 + 4} fontWeight="700" fontSize="12">{floorUnits[0]?.floorLabel ?? `${floor}. Kat`}</text>
            </g>
          );
        })}
      </svg>
    </Paper>
  );
}
