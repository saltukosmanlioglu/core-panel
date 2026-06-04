'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  GlobalStyles,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Step,
  StepLabel,
  Stepper,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import HistoryIcon from '@mui/icons-material/History';
import { Notification } from '@/components';
import { useSnackbar } from '@/hooks/useSnackbar';
import {
  createParcelCalculation,
  deleteParcelCalculation,
  fetchParcelFromTKGM,
  getDistricts,
  getNeighborhoods,
  getParcelCalculations,
  getProvinces,
} from '@/services/parcel-calculations/api';
import type {
  AdministrativeItem,
  ExtractedFields,
  ParcelCalculation,
  ParcelCalculationPayload,
  ZoningInfo,
} from '@/services/parcel-calculations/types';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { DocumentAnalysis } from './steps/document-analysis';
import { FacadeSetbacks } from './steps/facade-setbacks';
import { ParcelQuery } from './steps/parcel-query';
import { Result } from './steps/result';
import { ZoningSummary } from './steps/zoning-summary';
import type {
  EdgeRole,
  FloorOptionIndex,
  NumericInputValue,
} from './types';
import {
  calculateFootprintLocal,
  calculationToParcelResult,
  coverageRatioOptions,
  formatArea,
  formatDate,
  getOverhangVertices,
  getParcelVertices,
  makeOverhangs,
  normalizeParcelResult,
  splitParcelName,
  stepLabels,
} from './utils';

function mergeDocumentZoningInfo(
  planNotlariResult: ExtractedFields | null,
  imarDurumuResult: ExtractedFields | null,
): ZoningInfo | null {
  const planNotlari = planNotlariResult?.zoningInfo ?? null;
  const imarDurumu = imarDurumuResult?.zoningInfo ?? null;
  if (!planNotlari && !imarDurumu) return null;

  return {
    setbacks: {
      front: imarDurumu?.setbacks.front ?? planNotlari?.setbacks.front ?? null,
      back: imarDurumu?.setbacks.back ?? planNotlari?.setbacks.back ?? null,
      left: imarDurumu?.setbacks.left ?? planNotlari?.setbacks.left ?? null,
      right: imarDurumu?.setbacks.right ?? planNotlari?.setbacks.right ?? null,
    },
    taks: imarDurumu?.taks ?? planNotlari?.taks ?? null,
    kaks: imarDurumu?.kaks ?? planNotlari?.kaks ?? null,
    floorCount: imarDurumu?.floorCount ?? planNotlari?.floorCount ?? null,
    buildingHeight: imarDurumu?.buildingHeight ?? planNotlari?.buildingHeight ?? null,
    constructionOrder: imarDurumu?.constructionOrder ?? planNotlari?.constructionOrder ?? null,
    buildingDepth: imarDurumu?.buildingDepth ?? planNotlari?.buildingDepth ?? null,
    notes: [imarDurumu?.notes, planNotlari?.notes].filter(Boolean).join(' | ') || null,
  };
}

export default function ParcelCalculationPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = String(id);
  const { showSuccess, showError, notificationProps } = useSnackbar();

  const [provinces, setProvinces] = useState<AdministrativeItem[]>([]);
  const [districts, setDistricts] = useState<AdministrativeItem[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<AdministrativeItem[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<number | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<number | null>(null);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<number | null>(null);
  const [blockNumber, setBlockNumber] = useState('');
  const [parcelNumber, setParcelNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parcelResult, setParcelResult] = useState<ReturnType<typeof normalizeParcelResult> | null>(null);
  const [calculations, setCalculations] = useState<ParcelCalculation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [edgeRoles, setEdgeRoles] = useState<EdgeRole[]>([]);
  const [edgeSetbacks, setEdgeSetbacks] = useState<NumericInputValue[]>([]);
  const [coverageRatio, setCoverageRatio] = useState<number>(0.3);
  const [selectedFloorOption, setSelectedFloorOption] = useState<FloorOptionIndex>(0);
  const [edgeOverhangs, setEdgeOverhangs] = useState<NumericInputValue[]>([]);
  const [edgeOverhangActive, setEdgeOverhangActive] = useState<boolean[]>([]);
  const [planNotlariResult, setPlanNotlariResult] = useState<ExtractedFields | null>(null);
  const [imarDurumuResult, setImarDurumuResult] = useState<ExtractedFields | null>(null);
  const [calculationResult, setCalculationResult] = useState<ParcelCalculation | null>(null);
  const [isCalculatingResult, setIsCalculatingResult] = useState(false);
  const [calculationError, setCalculationError] = useState<string | null>(null);

  const zoningInfo = useMemo(
    () => mergeDocumentZoningInfo(planNotlariResult, imarDurumuResult),
    [imarDurumuResult, planNotlariResult],
  );
  const parcelVertices = useMemo(() => getParcelVertices(parcelResult), [parcelResult]);
  const filteredEdges = useMemo(() => parcelResult?.edges.filter((edge) => edge.length >= 1) ?? [], [parcelResult]);
  const canQuery = Boolean(
    selectedProvince
    && selectedDistrict
    && selectedNeighborhood
    && blockNumber.trim()
    && parcelNumber.trim(),
  );

  const frontSetback = useMemo(
    () => parseFloat(String(edgeSetbacks.find((_, index) => edgeRoles[index] === 'front') ?? 5)) || 5,
    [edgeRoles, edgeSetbacks],
  );
  const backSetback = useMemo(
    () => parseFloat(String(edgeSetbacks.find((_, index) => edgeRoles[index] === 'back') ?? 3)) || 3,
    [edgeRoles, edgeSetbacks],
  );
  const sideSetbackAverage = useMemo(() => {
    const sideValues = edgeSetbacks
      .filter((_, index) => edgeRoles[index] === 'side')
      .map((value) => parseFloat(String(value)) || 0);
    return sideValues.length > 0
      ? sideValues.reduce((total, value) => total + value, 0) / sideValues.length
      : 4;
  }, [edgeRoles, edgeSetbacks]);
  const currentSetbacks = useMemo(() => ({
    front: frontSetback,
    back: backSetback,
    left: sideSetbackAverage,
    right: sideSetbackAverage,
  }), [backSetback, frontSetback, sideSetbackAverage]);

  const localFootprintVertices = useMemo(() => {
    if (!parcelVertices || parcelVertices.length < 3) return null;
    const resolvedEdgeRoles: EdgeRole[] = parcelVertices.map((_, index) => {
      const userRole = edgeRoles[index];
      if (userRole) return userRole;
      const edge = parcelResult?.edges[index];
      return edge && edge.length >= 500 ? 'side' : 'inactive';
    });
    const activeEdges = edgeOverhangActive.map((active) => active ?? true);
    const perEdgeSetbacks = parcelVertices.map((_, index) => parseFloat(String(edgeSetbacks[index] ?? 0)) || 0);
    return calculateFootprintLocal(
      parcelVertices,
      perEdgeSetbacks,
      resolvedEdgeRoles,
      activeEdges,
    );
  }, [
    parcelVertices,
    edgeRoles,
    edgeSetbacks,
    edgeOverhangActive,
    parcelResult,
  ]);

  const parcelArea = parcelResult?.area ?? 0;
  const floorAreaRatio = zoningInfo?.['kaks'] ?? 1.5;
  const totalConstructionAreaPreview = parcelArea * 1.3 * floorAreaRatio;
  const footprintAreaPreview = parcelArea * coverageRatio;
  const floorOptions = useMemo(() => {
    const recommendedFootprintArea = parcelArea * coverageRatio;
    const lowFootprintArea = parcelArea * 0.2;
    const highFootprintArea = parcelArea * 0.4;

    return [
      {
        title: 'Önerilen',
        coverageRatio,
        footprintArea: recommendedFootprintArea,
        floorCount: recommendedFootprintArea > 0 ? Math.ceil(totalConstructionAreaPreview / recommendedFootprintArea) : 0,
      },
      {
        title: 'TAKS 0.20',
        coverageRatio: 0.2,
        footprintArea: lowFootprintArea,
        floorCount: lowFootprintArea > 0 ? Math.ceil(totalConstructionAreaPreview / lowFootprintArea) : 0,
      },
      {
        title: 'TAKS 0.40',
        coverageRatio: 0.4,
        footprintArea: highFootprintArea,
        floorCount: highFootprintArea > 0 ? Math.ceil(totalConstructionAreaPreview / highFootprintArea) : 0,
      },
    ];
  }, [coverageRatio, parcelArea, totalConstructionAreaPreview]);
  const selectedFloorCount = Math.max(1, floorOptions[selectedFloorOption]?.floorCount ?? 1);
  const selectedFootprintArea = floorOptions[selectedFloorOption]?.footprintArea ?? footprintAreaPreview;

  const effectiveOverhangs = useMemo(
    () => edgeOverhangs.map((value, index) => (
      (edgeOverhangActive[index] ?? true) && edgeRoles[index] !== 'inactive'
        ? (parseFloat(String(value)) || 0)
        : 0
    )),
    [edgeRoles, edgeOverhangActive, edgeOverhangs],
  );
  const visualizationFootprintVertices = calculationResult?.footprintVertices ?? localFootprintVertices ?? undefined;
  const perFloorOverhangVertices = useMemo(() => {
    if (!visualizationFootprintVertices || visualizationFootprintVertices.length < 3) return [];
    const overhangs = calculationResult?.overhangs ?? [];
    const upperFloors = overhangs
      .filter((o) => o.floor > 1 && (o.front > 0 || o.back > 0 || o.left > 0 || o.right > 0))
      .slice(0, 3);
    return upperFloors
      .map((overhang, index) => {
        const perEdge = edgeRoles.map((role) => {
          if (role === 'front') return overhang.front;
          if (role === 'back') return overhang.back;
          if (role === 'side') return (overhang.left + overhang.right) / 2;
          return 0;
        });
        const vertices = getOverhangVertices(visualizationFootprintVertices, perEdge);
        const label = index < 2 ? `${overhang.floor}. Kat çıkma` : 'Üst kat çıkma';
        return { floor: overhang.floor, label, vertices: vertices ?? [] };
      })
      .filter((item) => item.vertices.length >= 3);
  }, [calculationResult, visualizationFootprintVertices, edgeRoles]);
  const maxOverhangs = useMemo(() => {
    const sideValues = effectiveOverhangs.filter((_, index) => edgeRoles[index] === 'side');
    return {
      front: Math.max(0, ...effectiveOverhangs.filter((_, index) => edgeRoles[index] === 'front')),
      right: sideValues[0] ?? 0,
      back: Math.max(0, ...effectiveOverhangs.filter((_, index) => edgeRoles[index] === 'back')),
      left: sideValues[1] ?? sideValues[0] ?? 0,
    };
  }, [edgeRoles, effectiveOverhangs]);
  const visualOverhangVertices = useMemo(
    () => getOverhangVertices(visualizationFootprintVertices ?? [], effectiveOverhangs),
    [effectiveOverhangs, visualizationFootprintVertices],
  );

  const loadCalculations = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const items = await getParcelCalculations(projectId);
      setCalculations(items);
    } catch (loadError) {
      showError(getErrorMessage(loadError, 'Geçmiş hesaplamalar yüklenemedi'));
    } finally {
      setLoadingHistory(false);
    }
  }, [projectId]);

  useEffect(() => {
    let active = true;

    async function loadProvinces() {
      try {
        const items = await getProvinces();
        if (active) setProvinces(items);
      } catch (provinceError) {
        if (active) setError(getErrorMessage(provinceError, 'İller yüklenemedi'));
      }
    }

    void loadProvinces();
    void loadCalculations();

    return () => {
      active = false;
    };
  }, [loadCalculations]);

  useEffect(() => {
    if (!selectedProvince) {
      setDistricts([]);
      return;
    }

    let active = true;
    const provinceId = selectedProvince;

    async function loadDistricts() {
      try {
        const items = await getDistricts(provinceId);
        if (active) setDistricts(items);
      } catch (districtError) {
        if (active) setError(getErrorMessage(districtError, 'İlçeler yüklenemedi'));
      }
    }

    void loadDistricts();

    return () => {
      active = false;
    };
  }, [selectedProvince]);

  useEffect(() => {
    if (!selectedDistrict) {
      setNeighborhoods([]);
      return;
    }

    let active = true;
    const districtId = selectedDistrict;

    async function loadNeighborhoods() {
      try {
        const items = await getNeighborhoods(districtId);
        if (active) setNeighborhoods(items);
      } catch (neighborhoodError) {
        if (active) setError(getErrorMessage(neighborhoodError, 'Mahalleler yüklenemedi'));
      }
    }

    void loadNeighborhoods();

    return () => {
      active = false;
    };
  }, [selectedDistrict]);

  useEffect(() => {
    if (!zoningInfo) return;
    const extractedCoverageRatio = zoningInfo['taks'];
    if (
      extractedCoverageRatio !== null
      && coverageRatioOptions.some((option) => Math.abs(option - extractedCoverageRatio) < 0.001)
    ) {
      setCoverageRatio(extractedCoverageRatio);
    }
    setEdgeSetbacks((current) => current.map((value, index) => {
      const role = edgeRoles[index] ?? 'side';
      const sideValues = [zoningInfo.setbacks.left, zoningInfo.setbacks.right].filter((item): item is number => item !== null);
      const sideValue = sideValues.length > 0
        ? sideValues.reduce((total, item) => total + item, 0) / sideValues.length
        : null;
      if (role === 'inactive') return 0;
      if (role === 'front') return zoningInfo.setbacks.front ?? value;
      if (role === 'back') return zoningInfo.setbacks.back ?? value;
      return sideValue ?? value;
    }));
  }, [edgeRoles, zoningInfo]);

  useEffect(() => {
    if (!parcelResult?.edges) {
      setEdgeOverhangs([]);
      setEdgeOverhangActive([]);
      setEdgeRoles([]);
      setEdgeSetbacks([]);
      return;
    }
    const validEdges = parcelResult.edges.filter((edge) => edge.length >= 1);
    const sideDefault = (() => {
      const leftValue = zoningInfo?.setbacks.left;
      const rightValue = zoningInfo?.setbacks.right;
      if (leftValue != null && rightValue != null) return (leftValue + rightValue) / 2;
      return leftValue ?? rightValue ?? 4;
    })();

    setEdgeOverhangs(validEdges.map(() => 1.5));
    setEdgeOverhangActive(validEdges.map((edge) => edge.length >= 500));
    setEdgeRoles(validEdges.map((edge) => (edge.length >= 500 ? 'side' : 'inactive')));
    setEdgeSetbacks(validEdges.map((edge) => (edge.length < 500 ? 0 : sideDefault)));
  }, [parcelResult, zoningInfo]);

  const handleProvinceChange = (value: string) => {
    const nextValue = value ? Number(value) : null;
    setSelectedProvince(nextValue);
    setSelectedDistrict(null);
    setSelectedNeighborhood(null);
    setDistricts([]);
    setNeighborhoods([]);
  };

  const handleDistrictChange = (value: string) => {
    const nextValue = value ? Number(value) : null;
    setSelectedDistrict(nextValue);
    setSelectedNeighborhood(null);
    setNeighborhoods([]);
  };

  const handleRoleChange = (index: number, role: EdgeRole) => {
    setEdgeRoles((current) => {
      const next = [...current];
      next[index] = role;
      return next;
    });
    setEdgeSetbacks((current) => {
      const next = [...current];
      if (role === 'front') {
        next[index] = zoningInfo?.setbacks?.front ?? 5;
      } else if (role === 'back') {
        next[index] = zoningInfo?.setbacks?.back ?? 3;
      } else if (role === 'side') {
        const leftValue = zoningInfo?.setbacks?.left;
        const rightValue = zoningInfo?.setbacks?.right;
        next[index] = leftValue != null && rightValue != null
          ? (leftValue + rightValue) / 2
          : leftValue ?? rightValue ?? 4;
      } else {
        next[index] = 0;
      }
      return next;
    });
    if (role === 'inactive') {
      setEdgeOverhangActive((current) => {
        const next = [...current];
        next[index] = false;
        return next;
      });
    }
    setCalculationResult(null);
  };

  const handleQuery = async () => {
    if (!selectedNeighborhood || !blockNumber.trim() || !parcelNumber.trim()) return;

    try {
      setIsLoading(true);
      setError(null);
      setRotationDegrees(0);
      const result = await fetchParcelFromTKGM(projectId, {
        neighborhoodId: selectedNeighborhood,
        blockNo: blockNumber.trim(),
        parcelNo: parcelNumber.trim(),
        name: `${blockNumber.trim()}/${parcelNumber.trim()}`,
      });
      const normalized = normalizeParcelResult(result);
      if (getParcelVertices(normalized).length < 3) {
        throw new Error('Parsel geometrisi geçersiz');
      }
      setParcelResult(normalized);
      setCalculationResult(null);
      setPlanNotlariResult(null);
      setImarDurumuResult(null);
      setActiveStep(0);
    } catch (queryError) {
      setParcelResult(null);
      setError(getErrorMessage(queryError, 'Parsel sorgulanamadı'));
    } finally {
      setIsLoading(false);
    }
  };

  const computeResult = useCallback(() => {
    if (!parcelResult || parcelVertices.length < 3) return;

    try {
      setIsCalculatingResult(true);
      setCalculationError(null);

      const activeEdges = edgeOverhangActive.map((active) => active ?? true);
      const perEdgeSetbacks = parcelVertices.map((_, index) => parseFloat(String(edgeSetbacks[index] ?? 0)) || 0);
      const footprintVertices = calculateFootprintLocal(parcelVertices, perEdgeSetbacks, edgeRoles, activeEdges);
      const footprintArea = Math.round((Math.abs(footprintVertices.reduce((sum, point, index) => {
        const next = footprintVertices[(index + 1) % footprintVertices.length]!;
        return sum + (point.x * next.y - next.x * point.y);
      }, 0)) / 2 / 10000 + Number.EPSILON) * 100) / 100;
      const totalConstructionArea = Math.round((parcelArea * 1.3 * floorAreaRatio + Number.EPSILON) * 100) / 100;
      const now = new Date().toISOString();

      const computed: ParcelCalculation = {
        id: '',
        projectId,
        name: `${blockNumber.trim() || parcelResult.info.blockNo}/${parcelNumber.trim() || parcelResult.info.parcelNo}`,
        edges: filteredEdges,
        parcelArea,
        parcelVertices,
        setbackSource: 'manual',
        setbackFront: currentSetbacks.front,
        setbackBack: currentSetbacks.back,
        setbackLeft: currentSetbacks.left,
        setbackRight: currentSetbacks.right,
        footprintArea,
        footprintVertices,
        floorCount: selectedFloorCount,
        overhangs: makeOverhangs(selectedFloorCount, effectiveOverhangs),
        totalConstructionArea,
        planNotlariFileUrl: planNotlariResult?.fileUrl ?? null,
        planNotlariExtracted: planNotlariResult?.fields ?? null,
        imarDurumuFileUrl: imarDurumuResult?.fileUrl ?? null,
        imarDurumuExtracted: imarDurumuResult?.fields ?? null,
        status: 'preview',
        createdAt: now,
      };
      setCalculationResult(computed);
    } catch (resultError) {
      setCalculationError(getErrorMessage(resultError, 'Hesaplama tamamlanamadı'));
    } finally {
      setIsCalculatingResult(false);
    }
  }, [
    blockNumber,
    currentSetbacks,
    edgeRoles,
    edgeSetbacks,
    effectiveOverhangs,
    edgeOverhangActive,
    filteredEdges,
    floorAreaRatio,
    parcelNumber,
    parcelArea,
    parcelResult,
    parcelVertices,
    planNotlariResult,
    imarDurumuResult,
    projectId,
    selectedFloorCount,
  ]);

  const saveResult = useCallback(async () => {
    if (!parcelResult || parcelVertices.length < 3 || !calculationResult) return;

    try {
      setIsSaving(true);
      const payload: ParcelCalculationPayload & { edgeRoles: EdgeRole[]; activeEdges: boolean[]; 'kaks': number } = {
        name: `${blockNumber.trim() || parcelResult.info.blockNo}/${parcelNumber.trim() || parcelResult.info.parcelNo}`,
        edges: filteredEdges,
        parcelVertices,
        setbackSource: 'manual',
        setbacks: currentSetbacks,
        floorCount: selectedFloorCount,
        overhangs: makeOverhangs(selectedFloorCount, effectiveOverhangs),
        edgeRoles,
        'kaks': floorAreaRatio,
        activeEdges: edgeOverhangActive.map((active) => active ?? true),
        planNotlariFileUrl: planNotlariResult?.fileUrl ?? null,
        planNotlariExtracted: planNotlariResult?.fields ?? null,
        imarDurumuFileUrl: imarDurumuResult?.fileUrl ?? null,
        imarDurumuExtracted: imarDurumuResult?.fields ?? null,
      };
      const saved = await createParcelCalculation(projectId, payload);
      setCalculationResult(saved);
      setCalculations((current) => {
        const updated = [saved, ...current.filter((item) => item.id !== saved.id)];
        return updated.slice(0, 3);
      });
      showSuccess('Hesaplama kaydedildi');
    } catch (saveError) {
      showError(getErrorMessage(saveError, 'Hesaplama kaydedilemedi'));
    } finally {
      setIsSaving(false);
    }
  }, [
    blockNumber,
    calculationResult,
    currentSetbacks,
    edgeRoles,
    effectiveOverhangs,
    edgeOverhangActive,
    filteredEdges,
    floorAreaRatio,
    parcelNumber,
    parcelResult,
    parcelVertices,
    planNotlariResult,
    imarDurumuResult,
    projectId,
    selectedFloorCount,
    showError,
    showSuccess,
  ]);

  const handleLoadCalculation = (calculation: ParcelCalculation) => {
    const result = calculationToParcelResult(calculation);
    const { blockNumber: savedBlockNumber, parcelNumber: savedParcelNumber } = splitParcelName(calculation.name);
    setParcelResult(result);
    setBlockNumber(savedBlockNumber);
    setParcelNumber(savedParcelNumber);
    setRotationDegrees(0);
    setCalculationResult(calculation);
    setError(null);
    setCalculationError(null);
    setActiveStep(4);
    setShowHistory(false);
  };

  const handleDeleteCalculation = async (calculation: ParcelCalculation) => {
    try {
      await deleteParcelCalculation(calculation.id);
      setCalculations((current) => current.filter((item) => item.id !== calculation.id));
      if (calculationResult?.id === calculation.id) {
        setCalculationResult(null);
        setParcelResult(null);
        setActiveStep(0);
      }
      showSuccess('Hesaplama silindi');
    } catch (deleteError) {
      showError(getErrorMessage(deleteError, 'Hesaplama silinemedi'));
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1280, mx: 'auto' }}>
      <GlobalStyles styles={{
        'input[type=number]': {
          MozAppearance: 'textfield',
        },
        'input[type=number]::-webkit-outer-spin-button': {
          WebkitAppearance: 'none',
          margin: 0,
        },
        'input[type=number]::-webkit-inner-spin-button': {
          WebkitAppearance: 'none',
          margin: 0,
        },
      }}
      />
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
            Taban Oturum Alanı
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 13, mt: 0.5 }}>
            TKGM&apos;den parsel sorgulayarak arsa alanını görüntüleyin
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<HistoryIcon />}
          onClick={() => setShowHistory(true)}
          sx={{ alignSelf: { xs: 'stretch', sm: 'center' }, borderRadius: 1 }}
        >
          Geçmiş Hesaplamalar
        </Button>
      </Box>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {stepLabels.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {activeStep === 0 ? (
        <ParcelQuery
          provinces={provinces}
          districts={districts}
          neighborhoods={neighborhoods}
          selectedProvince={selectedProvince}
          selectedDistrict={selectedDistrict}
          selectedNeighborhood={selectedNeighborhood}
          blockNumber={blockNumber}
          parcelNumber={parcelNumber}
          isLoading={isLoading}
          error={error}
          parcelResult={parcelResult}
          parcelVertices={parcelVertices}
          canQuery={canQuery}
          rotationDegrees={rotationDegrees}
          setRotationDegrees={setRotationDegrees}
          onProvinceChange={handleProvinceChange}
          onDistrictChange={handleDistrictChange}
          onNeighborhoodChange={setSelectedNeighborhood}
          onBlockNumberChange={setBlockNumber}
          onParcelNumberChange={setParcelNumber}
          onQuery={() => void handleQuery()}
          onNext={() => setActiveStep(1)}
        />
      ) : null}

      {activeStep === 1 ? (
        <DocumentAnalysis
          projectId={projectId}
          planNotlariResult={planNotlariResult}
          imarDurumuResult={imarDurumuResult}
          onPlanNotlariResultChange={setPlanNotlariResult}
          onImarDurumuResultChange={setImarDurumuResult}
          onBack={() => setActiveStep(0)}
          onNext={() => setActiveStep(2)}
        />
      ) : null}

      {activeStep === 2 ? (
        <FacadeSetbacks
          edges={filteredEdges}
          edgeRoles={edgeRoles}
          edgeSetbacks={edgeSetbacks}
          setEdgeSetbacks={setEdgeSetbacks}
          edgeOverhangs={edgeOverhangs}
          setEdgeOverhangs={setEdgeOverhangs}
          edgeOverhangActive={edgeOverhangActive}
          setEdgeOverhangActive={setEdgeOverhangActive}
          parcelVertices={parcelVertices}
          localFootprintVertices={localFootprintVertices}
          calculationResult={calculationResult}
          visualOverhangVertices={visualOverhangVertices}
          setbacks={currentSetbacks}
          maxOverhangs={maxOverhangs}
          rotationDegrees={rotationDegrees}
          setRotationDegrees={setRotationDegrees}
          floorOptions={floorOptions}
          selectedFloorOption={selectedFloorOption}
          setSelectedFloorOption={setSelectedFloorOption}
          calculationError={calculationError}
          isCalculatingResult={isCalculatingResult}
          onRoleChange={handleRoleChange}
          onInputChange={() => setCalculationResult(null)}
          onBack={() => setActiveStep(1)}
          onCalculate={computeResult}
          onNext={() => setActiveStep(3)}
          hasParcelResult={Boolean(parcelResult)}
        />
      ) : null}

      {activeStep === 3 ? (
        <ZoningSummary
          edges={filteredEdges}
          edgeRoles={edgeRoles}
          edgeSetbacks={edgeSetbacks}
          calculationResult={calculationResult}
          floorCount={selectedFloorCount}
          onBack={() => setActiveStep(2)}
          onNext={() => setActiveStep(4)}
        />
      ) : null}

      {activeStep === 4 ? (
        <Result
          blockNumber={blockNumber}
          parcelNumber={parcelNumber}
          parcelResult={parcelResult}
          parcelArea={parcelArea}
          selectedFootprintArea={selectedFootprintArea}
          selectedFloorCount={selectedFloorCount}
          totalConstructionArea={totalConstructionAreaPreview}
          calculationResult={calculationResult}
          calculationError={calculationError}
          parcelVertices={parcelVertices}
          visualizationFootprintVertices={visualizationFootprintVertices}
          visualOverhangVertices={visualOverhangVertices}
          perFloorOverhangVertices={perFloorOverhangVertices}
          setbacks={currentSetbacks}
          maxOverhangs={maxOverhangs}
          edgeRoles={edgeRoles}
          edgeSetbacks={edgeSetbacks}
          edgeOverhangs={edgeOverhangs}
          edgeOverhangActive={edgeOverhangActive}
          rotationDegrees={rotationDegrees}
          setRotationDegrees={setRotationDegrees}
          isSaving={isSaving}
          isCalculatingResult={isCalculatingResult}
          onBack={() => setActiveStep(3)}
          onSave={() => void saveResult()}
        />
      ) : null}

      <Drawer
        anchor="right"
        open={showHistory}
        onClose={() => setShowHistory(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 420 } } }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Geçmiş Hesaplamalar
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', fontSize: 12 }}>
              Kaydedilmiş parseller
            </Typography>
          </Box>
          <IconButton onClick={() => setShowHistory(false)}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Divider />

        {loadingHistory ? (
          <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : calculations.length === 0 ? (
          <Box sx={{ p: 3 }}>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Henüz kayıtlı hesaplama yok.
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {calculations.map((calculation) => (
              <ListItem
                key={calculation.id}
                disablePadding
                secondaryAction={
                  <Tooltip title="Sil">
                    <IconButton edge="end" onClick={() => void handleDeleteCalculation(calculation)}>
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Tooltip>
                }
              >
                <ListItemButton onClick={() => handleLoadCalculation(calculation)} sx={{ pr: 8 }}>
                  <ListItemText
                    primary={calculation.name}
                    secondary={`${formatArea(calculation.parcelArea)} • ${formatDate(calculation.createdAt)}`}
                    primaryTypographyProps={{ fontWeight: 600, fontSize: 13 }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Drawer>

      <Notification {...notificationProps} />
    </Box>
  );
}
