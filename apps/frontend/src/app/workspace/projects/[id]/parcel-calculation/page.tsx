'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  Paper,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Apartment as ApartmentIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  CropSquare as CropSquareIcon,
  DeleteOutline as DeleteOutlineIcon,
  Description as DescriptionIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  Home as HomeIcon,
  RestartAlt as RestartAltIcon,
  Save as SaveIcon,
  UploadFile as UploadFileIcon,
} from '@mui/icons-material';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import { Notification } from '@/components';
import { useSnackbar } from '@/hooks/useSnackbar';
import { getErrorMessage } from '@/utils/getErrorMessage';
import {
  createParcelCalculation,
  deleteParcelCalculation,
  extractSetbacks,
  getParcelCalculations,
  updateParcelCalculation,
} from '@/services/parcel-calculations/api';
import type {
  Edge,
  Overhang,
  ParcelCalculation,
  Point,
  Setbacks,
} from '@/services/parcel-calculations/types';
import { ParcelVisualization } from './ParcelVisualization';

const steps = ['Kenar Bilgileri', 'Bahçe Çekmeleri', 'Çıkma Hesabı', 'Sonuçlar'];
const emptySetbacks: Setbacks = { front: 3, back: 3, left: 3, right: 3 };
const numberFormatter = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type SetbackKey = keyof Setbacks;

const setbackLabels: Record<SetbackKey, string> = {
  front: 'Ön Bahçe (m)',
  back: 'Arka Bahçe (m)',
  left: 'Sol Yan Bahçe (m)',
  right: 'Sağ Yan Bahçe (m)',
};

function nextLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

function createDefaultEdges(): Edge[] {
  return [
    { label: 'A', length: 20, angle: 90 },
    { label: 'B', length: 30, angle: 90 },
    { label: 'C', length: 20, angle: 90 },
    { label: 'D', length: 30, angle: 90 },
  ];
}

function makeFacadeOverhangs(edgeList: Edge[], previous: number[] = []): number[] {
  return edgeList.map((_, index) => previous[index] ?? 1.5);
}

function makeOverhangs(floorCount: number, facadeOverhangs: number[]): Overhang[] {
  return Array.from({ length: floorCount }, (_, index) => {
    const isGroundFloor = index === 0;

    return {
      floor: index + 1,
      front: isGroundFloor ? 0 : (facadeOverhangs[0] ?? 0),
      back: isGroundFloor ? 0 : (facadeOverhangs[2] ?? facadeOverhangs[0] ?? 0),
      left: isGroundFloor ? 0 : (facadeOverhangs[3] ?? facadeOverhangs[1] ?? 0),
      right: isGroundFloor ? 0 : (facadeOverhangs[1] ?? 0),
    };
  });
}

function facadeOverhangsFromCalculation(calculation: ParcelCalculation, edgeList: Edge[]): number[] {
  const firstFloor = calculation.overhangs.find((overhang) => overhang.floor === 2);

  return edgeList.map((_, index) => {
    if (index === 0) return firstFloor?.front ?? 1.5;
    if (index === 1) return firstFloor?.right ?? 1.5;
    if (index === 2) return firstFloor?.back ?? 1.5;
    return firstFloor?.left ?? 1.5;
  });
}

function formatArea(value: number | null | undefined): string {
  return `${numberFormatter.format(value ?? 0)} m²`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function parseNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundTo(value: number, precision: number): number {
  const multiplier = 10 ** precision;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function relabelEdges(edges: Edge[]): Edge[] {
  return edges.map((edge, index) => ({ ...edge, label: nextLabel(index) }));
}

function normalizeInteriorAngle(value: number): number {
  const normalized = ((value % 360) + 360) % 360;
  return Math.min(359, Math.max(1, normalized === 0 ? 360 : normalized));
}

function directionAfterEdges(edgeList: Edge[]): number {
  let direction = 90;

  edgeList.forEach((edge) => {
    if (!edge.length || !edge.angle) return;
    direction -= (180 - edge.angle);
  });

  return direction;
}

function directionBeforeEdge(edgeList: Edge[], edgeIndex: number): number {
  return directionAfterEdges(edgeList.slice(0, Math.max(0, edgeIndex)));
}

function computeVertices(edgeList: Edge[]): { vertices: Point[]; closureGap: number; isClosed: boolean } {
  let x = 0;
  let y = 0;
  let direction = 90;
  const vertices: Point[] = [{ x: 0, y: 0 }];

  for (const edge of edgeList) {
    if (!edge.length || !edge.angle) continue;
    const r = edge.length * 100 * Math.cos(direction * Math.PI / 180);
    const s = edge.length * 100 * Math.sin(direction * Math.PI / 180);
    x += r;
    y += s;
    vertices.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
    direction -= (180 - edge.angle);
  }

  const last = vertices[vertices.length - 1]!;
  const gap = Math.sqrt(last.x ** 2 + last.y ** 2) / 100;
  return { vertices, closureGap: gap, isClosed: gap < 0.1 };
}

function getOverhangVertices(
  footprintVertices: Point[],
  overhangs: number[],
  frontEdgeIndex: number,
): Point[] | undefined {
  if (footprintVertices.length < 3) return undefined;

  const n = footprintVertices.length;

  function getOverhangForEdge(edgeIndex: number): number {
    const rel = ((edgeIndex - frontEdgeIndex) % n + n) % n;
    if (rel === 0) return overhangs[0] ?? 0;
    if (rel === 1) return overhangs[1] ?? overhangs[0] ?? 0;
    if (rel === 2) return overhangs[2] ?? overhangs[0] ?? 0;
    if (rel === 3) return overhangs[3] ?? overhangs[1] ?? overhangs[0] ?? 0;
    return overhangs[rel % overhangs.length] ?? overhangs[0] ?? 0;
  }

  const maxOverhang = Math.max(...(overhangs.map((value) => value ?? 0)));
  if (maxOverhang <= 0) return undefined;

  const offsetEdges: Array<{ pt: Point; dir: Point }> = [];

  for (let i = 0; i < n; i++) {
    const p1 = footprintVertices[i]!;
    const p2 = footprintVertices[(i + 1) % n]!;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    const nx = dy / len;
    const ny = -dx / len;
    const overhangCm = getOverhangForEdge(i) * 100;

    offsetEdges.push({
      pt: { x: p1.x + nx * overhangCm, y: p1.y + ny * overhangCm },
      dir: { x: dx, y: dy },
    });
  }

  const result: Point[] = [];
  for (let i = 0; i < n; i++) {
    const prev = offsetEdges[(i - 1 + n) % n]!;
    const curr = offsetEdges[i]!;

    const cross = prev.dir.x * curr.dir.y - prev.dir.y * curr.dir.x;
    if (Math.abs(cross) < 0.000001) {
      result.push(curr.pt);
      continue;
    }

    const delta = { x: curr.pt.x - prev.pt.x, y: curr.pt.y - prev.pt.y };
    const t = (delta.x * curr.dir.y - delta.y * curr.dir.x) / cross;
    result.push({
      x: Math.round((prev.pt.x + prev.dir.x * t) * 100) / 100,
      y: Math.round((prev.pt.y + prev.dir.y * t) * 100) / 100,
    });
  }

  const resultArea = Math.abs(
    result.reduce((sum, point, index) => {
      const next = result[(index + 1) % n]!;
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2,
  );
  const footprintArea = Math.abs(
    footprintVertices.reduce((sum, point, index) => {
      const next = footprintVertices[(index + 1) % n]!;
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2,
  );

  if (resultArea < footprintArea) {
    const offsetEdges2: Array<{ pt: Point; dir: Point }> = [];

    for (let i = 0; i < n; i++) {
      const p1 = footprintVertices[i]!;
      const p2 = footprintVertices[(i + 1) % n]!;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const overhangCm = getOverhangForEdge(i) * 100;

      offsetEdges2.push({
        pt: { x: p1.x + nx * overhangCm, y: p1.y + ny * overhangCm },
        dir: { x: dx, y: dy },
      });
    }

    result.length = 0;

    for (let i = 0; i < n; i++) {
      const prev = offsetEdges2[(i - 1 + n) % n]!;
      const curr = offsetEdges2[i]!;
      const cross = prev.dir.x * curr.dir.y - prev.dir.y * curr.dir.x;

      if (Math.abs(cross) < 0.000001) {
        result.push(curr.pt);
        continue;
      }

      const delta = { x: curr.pt.x - prev.pt.x, y: curr.pt.y - prev.pt.y };
      const t = (delta.x * curr.dir.y - delta.y * curr.dir.x) / cross;
      result.push({
        x: Math.round((prev.pt.x + prev.dir.x * t) * 100) / 100,
        y: Math.round((prev.pt.y + prev.dir.y * t) * 100) / 100,
      });
    }
  }

  return result;
}

function applyCalculationToForm(
  calculation: ParcelCalculation,
  setters: {
    setName: (value: string) => void;
    setEdges: (value: Edge[]) => void;
    setSetbackSource: (value: 'manual' | 'document') => void;
    setSetbacks: (value: Setbacks) => void;
    setFloorCount: (value: number) => void;
    setFacadeOverhangs: (value: number[]) => void;
  },
): void {
  const calculationEdges = relabelEdges(calculation.edges);
  setters.setName(calculation.name);
  setters.setEdges(calculationEdges);
  setters.setSetbackSource(calculation.setbackSource);
  setters.setSetbacks({
    front: calculation.setbackFront,
    back: calculation.setbackBack,
    left: calculation.setbackLeft,
    right: calculation.setbackRight,
  });
  setters.setFloorCount(calculation.floorCount);
  setters.setFacadeOverhangs(facadeOverhangsFromCalculation(calculation, calculationEdges));
}

function SetbackInput({
  field,
  value,
  onChange,
  readOnly = false,
  canEdit = false,
  onEdit,
}: {
  field: SetbackKey;
  value: number;
  onChange: (value: number) => void;
  readOnly?: boolean;
  canEdit?: boolean;
  onEdit?: () => void;
}) {
  return (
    <TextField
      label={setbackLabels[field]}
      type="number"
      value={value}
      onChange={(event) => onChange(parseNumber(event.target.value))}
      fullWidth
      InputProps={{
        readOnly,
        endAdornment: canEdit ? (
          <InputAdornment position="end">
            <Tooltip title="Düzenle">
              <IconButton size="small" onClick={onEdit}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </InputAdornment>
        ) : null,
      }}
      inputProps={{ min: 0, step: 0.5, style: { MozAppearance: 'textfield' } }}
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

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ borderColor: '#e2e8f0', borderRadius: 1, height: '100%' }}>
      <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        <Box sx={{ color: '#2D6A4F', display: 'flex', pt: 0.25 }}>{icon}</Box>
        <Box>
          <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 700 }}>
            {title}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 900, color: '#0f172a', lineHeight: 1.25 }}>
            {value}
          </Typography>
          {subtitle ? (
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
      </CardContent>
    </Card>
  );
}

export default function ParcelCalculationPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = String(id);
  const { showSuccess, showError, notificationProps } = useSnackbar();

  const [calculations, setCalculations] = useState<ParcelCalculation[]>([]);
  const [currentCalc, setCurrentCalc] = useState<ParcelCalculation | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const [closureOverride, setClosureOverride] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [rotationDeg, setRotationDeg] = useState(0);

  const [name, setName] = useState('');
  const [edges, setEdges] = useState<Edge[]>(createDefaultEdges);
  const [frontEdgeIndex, setFrontEdgeIndex] = useState(0);
  const [edgeError, setEdgeError] = useState<string | null>(null);
  const [setbackSource, setSetbackSource] = useState<'manual' | 'document'>('manual');
  const [setbacks, setSetbacks] = useState<Setbacks>(emptySetbacks);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [editableDocumentFields, setEditableDocumentFields] = useState<Record<SetbackKey, boolean>>({
    front: false,
    back: false,
    left: false,
    right: false,
  });
  const [floorCount, setFloorCount] = useState(4);
  const [facadeOverhangs, setFacadeOverhangs] = useState<number[]>(() => makeFacadeOverhangs(createDefaultEdges()));

  const visualizationFacadeOverhangs = useMemo(() => {
    if (!currentCalc) return facadeOverhangs;

    const savedOverhang = currentCalc.overhangs.find((overhang) => overhang.floor === 2);
    return currentCalc.parcelVertices.map((_, index) => {
      if (index === 0) return savedOverhang?.front ?? 1.5;
      if (index === 1) return savedOverhang?.right ?? 1.5;
      if (index === 2) return savedOverhang?.back ?? 1.5;
      return savedOverhang?.left ?? 1.5;
    });
  }, [currentCalc, facadeOverhangs]);

  const overhangVertices = useMemo(
    () => currentCalc
      ? getOverhangVertices(currentCalc.footprintVertices, visualizationFacadeOverhangs, frontEdgeIndex)
      : undefined,
    [currentCalc, frontEdgeIndex, visualizationFacadeOverhangs],
  );
  const closureInfo = useMemo(() => computeVertices(edges), [edges]);
  const allEdgesFilled = edges.length >= 3 && edges.every((edge) => edge.length > 0 && edge.angle > 0);

  useEffect(() => {
    setClosureOverride(false);
  }, [edges]);

  useEffect(() => {
    setFrontEdgeIndex((current) => Math.min(current, Math.max(0, edges.length - 1)));
  }, [edges.length]);

  const loadCalculations = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const items = await getParcelCalculations(projectId);
      setCalculations(items);
    } catch (error) {
      showError(getErrorMessage(error, 'Geçmiş hesaplamalar yüklenemedi'));
    } finally {
      setLoadingHistory(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadCalculations();
  }, [loadCalculations]);

  const updateSetback = (field: SetbackKey, value: number) => {
    setSetbacks((current) => ({ ...current, [field]: Math.max(0, value) }));
  };

  const updateEdge = (index: number, field: 'length' | 'angle', value: number) => {
    setEdges((current) => current.map((edge, edgeIndex) => (
      edgeIndex === index ? { ...edge, [field]: value } : edge
    )));
  };

  const addEdge = () => {
    setEdges((current) => [
      ...current,
      { label: nextLabel(current.length), length: 10, angle: 90 },
    ]);
    setFacadeOverhangs((current) => [...current, 1.5]);
  };

  const deleteEdge = (index: number) => {
    setEdges((current) => relabelEdges(current.filter((_, edgeIndex) => edgeIndex !== index)));
    setFacadeOverhangs((current) => current.filter((_, overhangIndex) => overhangIndex !== index));
    setFrontEdgeIndex((current) => {
      const nextLength = edges.length - 1;
      if (nextLength <= 0 || current === index) return 0;
      if (current > index) return current - 1;
      return Math.min(current, nextLength - 1);
    });
  };

  const addClosingEdge = () => {
    const lastVertex = closureInfo.vertices[closureInfo.vertices.length - 1]!;
    const dx = -lastVertex.x;
    const dy = -lastVertex.y;
    const closingLength = Math.sqrt(dx ** 2 + dy ** 2) / 100;
    const currentDirection = directionAfterEdges(edges);
    const closingDirection = Math.atan2(dy, dx) * 180 / Math.PI;
    const interiorAngle = normalizeInteriorAngle(180 - (closingDirection - currentDirection));

    setEdges((current) => [
      ...current,
      {
        label: nextLabel(current.length),
        length: roundTo(closingLength, 2),
        angle: roundTo(interiorAngle, 1),
      },
    ]);
    setFacadeOverhangs((current) => [...current, 1.5]);
  };

  const calculateLastAngle = () => {
    if (edges.length === 0 || closureInfo.vertices.length < 2) return;

    const lastEdgeIndex = edges.length - 1;
    const previousVertex = closureInfo.vertices[closureInfo.vertices.length - 2]!;
    const directionBeforeLast = directionBeforeEdge(edges, lastEdgeIndex);
    const requiredDirection = Math.atan2(-previousVertex.y, -previousVertex.x) * (180 / Math.PI);
    const candidate1 = normalizeInteriorAngle(180 - (requiredDirection - directionBeforeLast));
    const candidate2 = normalizeInteriorAngle(candidate1 + 180);

    function testAngle(angle: number): number {
      const testEdges = edges.map((edge, index) => (
        index === lastEdgeIndex ? { ...edge, angle } : edge
      ));
      const vertices = computeVertices(testEdges).vertices;
      const last = vertices[vertices.length - 1];
      if (!last) return Infinity;
      return Math.sqrt(last.x ** 2 + last.y ** 2);
    }

    const gap1 = testAngle(candidate1);
    const gap2 = testAngle(candidate2);
    const bestAngle = gap1 <= gap2 ? candidate1 : candidate2;

    setEdges((current) => current.map((edge, index) => (
      index === lastEdgeIndex ? { ...edge, angle: roundTo(bestAngle, 1) } : edge
    )));
  };

  const continueWithClosureWarning = () => {
    setClosureOverride(true);
    if (validateEdges()) setActiveStep(1);
  };

  const validateEdges = (): boolean => {
    if (edges.length < 3) {
      setEdgeError('En az 3 kenar girilmelidir');
      return false;
    }

    const invalid = edges.find((edge) => edge.length <= 0 || edge.angle <= 0 || edge.angle >= 360);
    if (invalid) {
      setEdgeError('Uzunluklar pozitif, iç açılar 1-359 derece arasında olmalıdır');
      return false;
    }

    setEdgeError(null);
    return true;
  };

  const handleSetbackSourceChange = (_event: React.MouseEvent<HTMLElement>, value: 'manual' | 'document' | null) => {
    if (!value) return;
    setSetbackSource(value);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setDocumentFile(file);
    setExtracted(false);
    event.currentTarget.value = '';
  };

  const handleExtract = async () => {
    if (!documentFile) {
      showError('Belge seçin');
      return;
    }

    try {
      setExtracting(true);
      const result = await extractSetbacks(projectId, documentFile);
      setSetbacks(result);
      setExtracted(true);
      setEditableDocumentFields({ front: false, back: false, left: false, right: false });
      showSuccess('Bahçe çekmeleri belgeden okundu');
    } catch (error) {
      showError(getErrorMessage(error, 'Belge okunamadı'));
    } finally {
      setExtracting(false);
    }
  };

  const handleFloorCountChange = (value: number) => {
    const next = Math.min(30, Math.max(1, Math.trunc(value || 1)));
    setFloorCount(next);
  };

  const updateFacadeOverhang = (index: number, value: number) => {
    setFacadeOverhangs((current) => edges.map((_, overhangIndex) => (
      overhangIndex === index ? Math.max(0, value) : current[overhangIndex] ?? 1.5
    )));
  };

  const resetWizard = () => {
    const defaultEdges = createDefaultEdges();
    setCurrentCalc(null);
    setActiveStep(0);
    setName('');
    setEdges(defaultEdges);
    setFrontEdgeIndex(0);
    setEdgeError(null);
    setSetbackSource('manual');
    setSetbacks(emptySetbacks);
    setDocumentFile(null);
    setExtracted(false);
    setEditableDocumentFields({ front: false, back: false, left: false, right: false });
    setFloorCount(4);
    setFacadeOverhangs(makeFacadeOverhangs(defaultEdges));
  };

  const handleLoadCalculation = (calculation: ParcelCalculation) => {
    setCurrentCalc(calculation);
    setFrontEdgeIndex(0);
    applyCalculationToForm(calculation, {
      setName,
      setEdges,
      setSetbackSource,
      setSetbacks,
      setFloorCount,
      setFacadeOverhangs,
    });
    setActiveStep(3);
    setShowHistory(false);
  };

  const handleDeleteCalculation = async (calculation: ParcelCalculation) => {
    try {
      await deleteParcelCalculation(calculation.id);
      setCalculations((current) => current.filter((item) => item.id !== calculation.id));
      if (currentCalc?.id === calculation.id) resetWizard();
      showSuccess('Hesaplama silindi');
    } catch (error) {
      showError(getErrorMessage(error, 'Hesaplama silinemedi'));
    }
  };

  const handleCalculate = async () => {
    if (!validateEdges()) {
      setActiveStep(0);
      return;
    }

    try {
      setIsCalculating(true);
      const payload = {
        name: name.trim() || 'Hesaplama',
        edges: relabelEdges(edges),
        frontEdgeIndex,
        setbackSource,
        setbacks,
        floorCount,
        overhangs: makeOverhangs(floorCount, facadeOverhangs),
      };
      const calculation = currentCalc
        ? await updateParcelCalculation(currentCalc.id, payload)
        : await createParcelCalculation(projectId, payload);

      setCurrentCalc(calculation);
      applyCalculationToForm(calculation, {
        setName,
        setEdges,
        setSetbackSource,
        setSetbacks,
        setFloorCount,
        setFacadeOverhangs,
      });
      setActiveStep(3);
      await loadCalculations();
      showSuccess('Hesaplama tamamlandı');
    } catch (error) {
      showError(getErrorMessage(error, 'Hesaplama tamamlanamadı'));
    } finally {
      setIsCalculating(false);
    }
  };

  const renderEdgeStep = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>Arsa Kenar Bilgileri</Typography>
        <Typography variant="body2" sx={{ color: '#64748b' }}>
          Her kenar için uzunluk ve iç açı değerini girin
        </Typography>
      </Box>

      <Alert severity="info">
        Kenarları sırayla girin. İlk köşe (A) koordinat başlangıç noktası olarak kabul edilir. İç açı: iki kenar arasındaki iç açı değeri.
      </Alert>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Kenar</TableCell>
              <TableCell>Uzunluk (m)</TableCell>
              <TableCell>İç Açı (°)</TableCell>
              <TableCell align="right">Sil</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {edges.map((edge, index) => (
              <TableRow key={`${edge.label}-${index}`}>
                <TableCell>
                  <Chip label={edge.label} size="small" sx={{ fontWeight: 900, minWidth: 36 }} />
                </TableCell>
                <TableCell>
                  <TextField
                    type="number"
                    size="small"
                    value={edge.length}
                    onChange={(event) => updateEdge(index, 'length', parseNumber(event.target.value))}
                    inputProps={{ step: 0.01, min: 0.1 }}
                    fullWidth
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    type="number"
                    size="small"
                    value={edge.angle}
                    onChange={(event) => updateEdge(index, 'angle', parseNumber(event.target.value))}
                    inputProps={{ step: 0.1, min: 1, max: 359 }}
                    fullWidth
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Sil">
                    <span>
                      <IconButton
                        size="small"
                        disabled={edges.length <= 3}
                        onClick={() => deleteEdge(index)}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography sx={{ fontWeight: 800 }}>Ön Cephe (Yola Bakan Kenar)</Typography>
        <Typography variant="body2" sx={{ color: '#64748b' }}>
          Hangi kenar yola bakıyor? Bahçe çekme mesafeleri buna göre atanır.
        </Typography>
        <ToggleButtonGroup
          value={frontEdgeIndex}
          exclusive
          onChange={(_event, value: number | null) => {
            if (value !== null) setFrontEdgeIndex(value);
          }}
          size="small"
          sx={{ flexWrap: 'wrap' }}
        >
          {edges.map((edge, index) => (
            <ToggleButton key={`${edge.label}-${index}`} value={index}>
              {edge.label} Kenarı
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {allEdgesFilled ? (
        closureInfo.isClosed ? (
          <Alert severity="success" icon={<CheckCircleIcon />}>
            Polygon kapalı ✓
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Alert severity="warning">
              Polygon kapanmıyor — son köşe ile başlangıç arasında {closureInfo.closureGap.toFixed(2)} m boşluk var.
            </Alert>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button variant="outlined" onClick={addClosingEdge}>
                Son Kenarı Otomatik Ekle
              </Button>
              <Button variant="outlined" onClick={calculateLastAngle}>
                Son Açıyı Otomatik Hesapla
              </Button>
              <Button variant="contained" color="warning" onClick={continueWithClosureWarning}>
                Uyarıyla Devam Et
              </Button>
            </Box>
            <Typography variant="body2" sx={{ color: '#92400e' }}>
              Kapanmayan polygon hesaplamalarda hatalara yol açabilir.
            </Typography>
          </Box>
        )
      ) : null}

      {edgeError ? <Alert severity="error">{edgeError}</Alert> : null}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Button startIcon={<AddIcon />} variant="outlined" onClick={addEdge}>
          Kenar Ekle
        </Button>
        <TextField
          label="Hesaplama Adı"
          value={name}
          onChange={(event) => setName(event.target.value)}
          sx={{ minWidth: { xs: '100%', sm: 280 } }}
        />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          disabled={allEdgesFilled && !closureInfo.isClosed && !closureOverride}
          onClick={() => {
            if (validateEdges()) setActiveStep(1);
          }}
          sx={{ backgroundColor: '#2D6A4F', fontWeight: 800, '&:hover': { backgroundColor: '#235c43' } }}
        >
          İleri
        </Button>
      </Box>
    </Box>
  );

  const renderSetbackFields = (documentMode: boolean) => (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
      {(Object.keys(setbackLabels) as SetbackKey[]).map((field) => (
        <SetbackInput
          key={field}
          field={field}
          value={setbacks[field]}
          onChange={(value) => updateSetback(field, value)}
          readOnly={documentMode && extracted && !editableDocumentFields[field]}
          canEdit={documentMode && extracted && !editableDocumentFields[field]}
          onEdit={() => setEditableDocumentFields((current) => ({ ...current, [field]: true }))}
        />
      ))}
    </Box>
  );

  const renderSetbackStep = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>Bahçe Çekme Mesafeleri</Typography>
      </Box>

      <ToggleButtonGroup
        exclusive
        value={setbackSource}
        onChange={handleSetbackSourceChange}
        sx={{ alignSelf: 'flex-start' }}
      >
        <ToggleButton value="document">İmar Belgesinden Oku</ToggleButton>
        <ToggleButton value="manual">Manuel Giriş</ToggleButton>
      </ToggleButtonGroup>

      {setbackSource === 'document' ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box
            sx={{
              border: '1px dashed #94a3b8',
              borderRadius: 1,
              p: 3,
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'stretch', sm: 'center' },
              justifyContent: 'space-between',
              gap: 2,
              backgroundColor: '#f8fafc',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <DescriptionIcon sx={{ color: '#2D6A4F', fontSize: 34 }} />
              <Box>
                <Typography sx={{ fontWeight: 900 }}>İmar durumu veya plan notları belgesini yükleyin</Typography>
                <Typography variant="body2" sx={{ color: '#64748b' }}>PDF veya görsel dosya yükleyin</Typography>
                {documentFile ? (
                  <Typography variant="caption" sx={{ color: '#0f172a', fontWeight: 700 }}>{documentFile.name}</Typography>
                ) : null}
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
                Dosya Seç
                <input hidden type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} />
              </Button>
              {documentFile ? (
                <Button
                  variant="contained"
                  disabled={extracting}
                  onClick={() => void handleExtract()}
                  sx={{ backgroundColor: '#2D6A4F', fontWeight: 800, '&:hover': { backgroundColor: '#235c43' } }}
                >
                  {extracting ? <CircularProgress color="inherit" size={18} sx={{ mr: 1 }} /> : null}
                  Çekmeleri Oku
                </Button>
              ) : null}
            </Box>
          </Box>

          {extracting ? (
            <Alert icon={<CircularProgress size={18} />} severity="info">Belge okunuyor...</Alert>
          ) : null}

          {extracted ? (
            <Alert icon={<CheckCircleIcon />} severity="success">Belgeden okundu</Alert>
          ) : null}

          {renderSetbackFields(true)}
        </Box>
      ) : renderSetbackFields(false)}

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button variant="outlined" onClick={() => setActiveStep(0)}>Geri</Button>
        <Button
          variant="contained"
          onClick={() => setActiveStep(2)}
          sx={{ backgroundColor: '#2D6A4F', fontWeight: 800, '&:hover': { backgroundColor: '#235c43' } }}
        >
          İleri
        </Button>
      </Box>
    </Box>
  );

  const renderOverhangStep = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>Kat Çıkmaları</Typography>
        <Typography variant="body2" sx={{ color: '#64748b' }}>
          Her cephe için çıkma mesafesini belirleyin
        </Typography>
      </Box>

      <Alert severity="info">Çıkma mesafesi tüm katlara eşit olarak uygulanır. Zemin kat için çıkma uygulanmaz.</Alert>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Cephe</TableCell>
              <TableCell>Kenar Uzunluğu</TableCell>
              <TableCell>Çıkma Mesafesi (m)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {edges.map((edge, index) => (
              <TableRow key={`${edge.label}-${index}`}>
                <TableCell>
                  <Chip label={edge.label} size="small" sx={{ fontWeight: 900, minWidth: 36 }} />
                </TableCell>
                <TableCell>
                  <Typography sx={{ color: '#334155', fontWeight: 700 }}>
                    {numberFormatter.format(edge.length)} m
                  </Typography>
                </TableCell>
                <TableCell>
                  <TextField
                    type="number"
                    size="small"
                    value={facadeOverhangs[index] ?? 1.5}
                    onChange={(event) => updateFacadeOverhang(index, parseNumber(event.target.value))}
                    inputProps={{ min: 0, step: 0.5, style: { MozAppearance: 'textfield' } }}
                    sx={{
                      maxWidth: 220,
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
                    fullWidth
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button variant="outlined" onClick={() => setActiveStep(1)}>Geri</Button>
        <Button
          variant="contained"
          disabled={isCalculating}
          onClick={() => void handleCalculate()}
          sx={{ backgroundColor: '#2D6A4F', fontWeight: 800, '&:hover': { backgroundColor: '#235c43' } }}
        >
          {isCalculating ? <CircularProgress color="inherit" size={18} sx={{ mr: 1 }} /> : null}
          {isCalculating ? 'Hesaplanıyor...' : 'Hesapla'}
        </Button>
      </Box>
    </Box>
  );

  const renderResultsStep = () => {
    if (!currentCalc) {
      return <Alert severity="info">Sonuçları görmek için hesaplama yapın.</Alert>;
    }

    const currentSetbacks = {
      front: currentCalc.setbackFront,
      back: currentCalc.setbackBack,
      left: currentCalc.setbackLeft,
      right: currentCalc.setbackRight,
    };
    const maxOverhangs = {
      front: visualizationFacadeOverhangs[0] ?? 0,
      back: visualizationFacadeOverhangs[2] ?? visualizationFacadeOverhangs[0] ?? 0,
      left: visualizationFacadeOverhangs[3] ?? visualizationFacadeOverhangs[1] ?? 0,
      right: visualizationFacadeOverhangs[1] ?? 0,
    };

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>Hesaplama Sonuçları</Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
          <SummaryCard title="Arsa Alanı" value={formatArea(currentCalc.parcelArea)} icon={<CropSquareIcon />} />
          <SummaryCard title="Taban Oturumu" value={formatArea(currentCalc.footprintArea)} subtitle="Bahçe çekmeleri sonrası" icon={<HomeIcon />} />
          <SummaryCard title="Toplam İnşaat Alanı" value={formatArea(currentCalc.totalConstructionArea)} subtitle="Çıkmalar dahil" icon={<ApartmentIcon />} />
        </Box>

        <Alert severity="info">
          Çekmeler: Ön {currentCalc.setbackFront}m | Arka {currentCalc.setbackBack}m | Sol {currentCalc.setbackLeft}m | Sağ {currentCalc.setbackRight}m
        </Alert>

        <Card variant="outlined" sx={{ borderColor: '#e2e8f0', borderRadius: 1 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography sx={{ fontWeight: 900 }}>Genel Görünüm</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <IconButton size="small" onClick={() => setRotationDeg((rotation) => rotation - 15)}>
                  <RotateLeftIcon fontSize="small" />
                </IconButton>
                <Typography fontSize={12} color="text.secondary" sx={{ minWidth: 32, textAlign: 'center' }}>
                  {rotationDeg}°
                </Typography>
                <IconButton size="small" onClick={() => setRotationDeg((rotation) => rotation + 15)}>
                  <RotateRightIcon fontSize="small" />
                </IconButton>
                {rotationDeg !== 0 ? (
                  <IconButton size="small" onClick={() => setRotationDeg(0)}>
                    <RestartAltIcon fontSize="small" />
                  </IconButton>
                ) : null}
              </Box>
            </Box>
            <ParcelVisualization
              parcelVertices={currentCalc.parcelVertices}
              footprintVertices={currentCalc.footprintVertices}
              overhangVertices={overhangVertices}
              width={860}
              height={560}
              showLabels
              showSetbackAnnotations
              setbacks={currentSetbacks}
              showOverhangAnnotations
              maxOverhangs={maxOverhangs}
              rotationDeg={rotationDeg}
            />
          </CardContent>
        </Card>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Button startIcon={<RestartAltIcon />} variant="outlined" onClick={resetWizard}>
            Yeni Hesaplama
          </Button>
          <Button startIcon={<SaveIcon />} variant="outlined" onClick={() => showSuccess('Hesaplama kaydedildi')}>
            Kaydet
          </Button>
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'flex-start' },
          gap: 2,
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, color: '#0f172a' }}>
            Taban Oturum Alanı
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            Arsa kenar bilgilerini girerek taban oturum alanını hesaplayın
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<HistoryIcon />} onClick={() => setShowHistory(true)}>
          Geçmiş Hesaplamalar
        </Button>
      </Box>

      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 1 }}>
        {steps.map((step) => (
          <Step key={step}>
            <StepLabel>{step}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Divider />

      {activeStep === 0 ? renderEdgeStep() : null}
      {activeStep === 1 ? renderSetbackStep() : null}
      {activeStep === 2 ? renderOverhangStep() : null}
      {activeStep === 3 ? renderResultsStep() : null}

      <Drawer
        anchor="right"
        open={showHistory}
        onClose={() => setShowHistory(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 400 }, p: 2.5 } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>Geçmiş Hesaplamalar</Typography>
          <IconButton onClick={() => setShowHistory(false)}><CloseIcon /></IconButton>
        </Box>

        {loadingHistory ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : calculations.length === 0 ? (
          <Alert severity="info">Henüz kayıtlı hesaplama yok.</Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {calculations.map((calculation) => (
              <Card key={calculation.id} variant="outlined" sx={{ borderRadius: 1, borderColor: '#e2e8f0' }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography sx={{ fontWeight: 900 }}>{calculation.name}</Typography>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>{formatDate(calculation.createdAt)}</Typography>
                    </Box>
                    <Tooltip title="Sil">
                      <IconButton size="small" onClick={() => void handleDeleteCalculation(calculation)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Typography variant="body2" sx={{ color: '#334155', mt: 1 }}>
                    Arsa: {formatArea(calculation.parcelArea)} | Taban: {formatArea(calculation.footprintArea)}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ mt: 1.5 }}
                    onClick={() => handleLoadCalculation(calculation)}
                  >
                    Yükle
                  </Button>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </Drawer>

      <Notification {...notificationProps} />
    </Box>
  );
}
