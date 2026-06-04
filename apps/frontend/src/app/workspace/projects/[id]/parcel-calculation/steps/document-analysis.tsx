'use client';

import { useState, type ChangeEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { extractParcelDocument } from '@/services/parcel-calculations/api';
import type {
  ExtractedFields,
  ParcelDocumentType,
} from '@/services/parcel-calculations/types';
import { getErrorMessage } from '@/utils/getErrorMessage';

interface DocumentAnalysisProps {
  projectId: string;
  planNotlariResult: ExtractedFields | null;
  imarDurumuResult: ExtractedFields | null;
  onPlanNotlariResultChange: (result: ExtractedFields | null) => void;
  onImarDurumuResultChange: (result: ExtractedFields | null) => void;
  onBack: () => void;
  onNext: () => void;
}

interface DocumentSectionConfig {
  documentType: ParcelDocumentType;
  title: string;
  helperText: string;
  accept: string;
  labels: Record<string, string>;
}

const sectionConfigs: DocumentSectionConfig[] = [
  {
    documentType: 'plan_notlari',
    title: 'Plan Notları',
    helperText: 'PDF, görsel veya DOCX dosyası yükleyebilirsiniz.',
    accept: '.pdf,.jpg,.jpeg,.png,.webp,.docx',
    labels: {
      plan_notu: 'Plan Notu',
      yapi_yuksekligi: 'Yapı Yüksekliği',
      taks: 'TAKS',
      kaks: 'KAKS',
      emsal: 'Emsal',
      kat_adedi: 'Kat Adedi',
      on_bahce_cekme: 'Ön Çekme',
      arka_bahce_cekme: 'Arka Çekme',
      sol_bahce_cekme: 'Sol Çekme',
      sag_bahce_cekme: 'Sağ Çekme',
    },
  },
  {
    documentType: 'imar_durumu',
    title: 'İmar Durumu',
    helperText: 'PDF veya görsel dosyası yükleyebilirsiniz.',
    accept: '.pdf,.jpg,.jpeg,.png,.webp',
    labels: {
      imar_durumu: 'İmar Durumu',
      zona_tipi: 'Zona Tipi',
      yapilasma_kosullari: 'Yapılaşma Koşulları',
      parsel_alani: 'Parsel Alanı',
      ada_no: 'Ada No',
      parsel_no: 'Parsel No',
      taks: 'TAKS',
      kaks: 'KAKS',
      kat_adedi: 'Kat Adedi',
      yapi_yuksekligi: 'Yapı Yüksekliği',
      on_bahce_cekme: 'Ön Çekme',
      arka_bahce_cekme: 'Arka Çekme',
      sol_bahce_cekme: 'Sol Çekme',
      sag_bahce_cekme: 'Sağ Çekme',
    },
  },
];

export function DocumentAnalysis({
  projectId,
  planNotlariResult,
  imarDurumuResult,
  onPlanNotlariResultChange,
  onImarDurumuResultChange,
  onBack,
  onNext,
}: DocumentAnalysisProps) {
  const [files, setFiles] = useState<Record<ParcelDocumentType, File | null>>({
    plan_notlari: null,
    imar_durumu: null,
  });
  const [loading, setLoading] = useState<Record<ParcelDocumentType, boolean>>({
    plan_notlari: false,
    imar_durumu: false,
  });
  const [errors, setErrors] = useState<Record<ParcelDocumentType, string | null>>({
    plan_notlari: null,
    imar_durumu: null,
  });

  const resultFor = (documentType: ParcelDocumentType) => (
    documentType === 'plan_notlari' ? planNotlariResult : imarDurumuResult
  );

  const setResultFor = (documentType: ParcelDocumentType, result: ExtractedFields | null) => {
    if (documentType === 'plan_notlari') {
      onPlanNotlariResultChange(result);
    } else {
      onImarDurumuResultChange(result);
    }
  };

  const handleFileChange = (
    documentType: ParcelDocumentType,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] ?? null;
    setFiles((current) => ({ ...current, [documentType]: file }));
    setErrors((current) => ({ ...current, [documentType]: null }));
    setResultFor(documentType, null);
  };

  const clearDocument = (documentType: ParcelDocumentType) => {
    setFiles((current) => ({ ...current, [documentType]: null }));
    setErrors((current) => ({ ...current, [documentType]: null }));
    setResultFor(documentType, null);
  };

  const runAnalysis = async (documentType: ParcelDocumentType) => {
    const file = files[documentType];
    if (!file) return;

    try {
      setLoading((current) => ({ ...current, [documentType]: true }));
      setErrors((current) => ({ ...current, [documentType]: null }));
      const result = await extractParcelDocument(projectId, documentType, file);
      setResultFor(documentType, result);
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [documentType]: getErrorMessage(error, 'Belge analizi tamamlanamadı'),
      }));
    } finally {
      setLoading((current) => ({ ...current, [documentType]: false }));
    }
  };

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
          İmar Belgeleri
        </Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: 12, mt: 0.5 }}>
          Belgeleri ayrı ayrı yükleyip analiz edebilirsiniz.
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        {sectionConfigs.map((config) => (
          <DocumentUploadSection
            key={config.documentType}
            config={config}
            file={files[config.documentType]}
            isLoading={loading[config.documentType]}
            error={errors[config.documentType]}
            result={resultFor(config.documentType)}
            onFileChange={(event) => handleFileChange(config.documentType, event)}
            onClear={() => clearDocument(config.documentType)}
            onAnalyze={() => void runAnalysis(config.documentType)}
          />
        ))}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Button size="small" variant="outlined" onClick={onBack}>
          ← Geri
        </Button>
        <Button size="small" variant="contained" onClick={onNext}>
          İleri →
        </Button>
      </Box>
    </Stack>
  );
}

function DocumentUploadSection({
  config,
  file,
  isLoading,
  error,
  result,
  onFileChange,
  onClear,
  onAnalyze,
}: {
  config: DocumentSectionConfig;
  file: File | null;
  isLoading: boolean;
  error: string | null;
  result: ExtractedFields | null;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  onAnalyze: () => void;
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 1, borderColor: '#e2e8f0' }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
          {config.title}
        </Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: 12, mt: 0.5 }}>
          {config.helperText}
        </Typography>

        <Box
          sx={{
            mt: 2,
            p: 1.5,
            border: '1px dashed',
            borderColor: '#cbd5e1',
            borderRadius: 1,
            display: 'flex',
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            gap: 1.5,
            flexDirection: { xs: 'column', sm: 'row' },
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 600 }}>
              {file ? file.name : 'Belge seçilmedi'}
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: 11 }}>
              {file ? `${Math.round(file.size / 1024)} KB` : 'Yüklemeden devam edebilirsiniz'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              component="label"
              size="small"
              variant="outlined"
              startIcon={<UploadFileIcon />}
              disabled={isLoading}
            >
              Dosya Seç
              <input
                hidden
                type="file"
                accept={config.accept}
                onChange={onFileChange}
              />
            </Button>
            {file ? (
              <>
                <Button
                  size="small"
                  variant="contained"
                  onClick={onAnalyze}
                  disabled={isLoading}
                >
                  {isLoading ? <CircularProgress color="inherit" size={16} sx={{ mr: 1 }} /> : null}
                  Analiz Et
                </Button>
                <IconButton size="small" onClick={onClear} disabled={isLoading} aria-label={`${config.title} belgesini kaldır`}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </>
            ) : null}
          </Box>
        </Box>

        {isLoading ? (
          <Alert icon={<CircularProgress size={18} />} severity="info" sx={{ mt: 1.5, py: 0.5, fontSize: 12 }}>
            Belge okunuyor...
          </Alert>
        ) : null}

        {result ? (
          <Alert icon={<CheckCircleIcon fontSize="small" />} severity="success" sx={{ mt: 1.5, py: 0.5, fontSize: 12 }}>
            Belgeden okundu
          </Alert>
        ) : null}

        {error ? (
          <Alert severity="error" sx={{ mt: 1.5, py: 0.5, fontSize: 12 }}>
            {error}
          </Alert>
        ) : null}

        {result ? (
          <ResultGrid result={result} labels={config.labels} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function ResultGrid({
  result,
  labels,
}: {
  result: ExtractedFields;
  labels: Record<string, string>;
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
        gap: 1,
        mt: 1.5,
      }}
    >
      {Object.entries(labels).map(([key, label]) => (
        <Box key={key} sx={{ border: '1px solid #e2e8f0', borderRadius: 1, p: 1 }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            {label}
          </Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 700, overflowWrap: 'anywhere' }}>
            {formatFieldValue(result.fields[key])}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function formatFieldValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}
