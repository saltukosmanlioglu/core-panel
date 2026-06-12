'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Box,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { Notification } from '@/components';
import { useSnackbar } from '@/hooks/useSnackbar';
import {
  createOfferDocument,
  downloadOfferPdf,
  getLatestParcelArea,
  updateOfferDocument,
} from '@/services/offer-documents/api';
import type {
  OfferDocument,
  OfferDocumentPayload,
} from '@/services/offer-documents/types';
import { getCompaniesApi } from '@/services/admin/api';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { OfferForm } from './offer-form/offer-form';

export default function OfferDocumentsPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = String(id);
  const { showSuccess, showError, notificationProps } = useSnackbar();
  const [footprintArea, setFootprintArea] = useState<number | null>(null);
  const [floorAreas, setFloorAreas] = useState<Array<{ floorNumber: number; netArea: number }> | null>(null);
  const [parcelCalculationId, setParcelCalculationId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(true);
  const [editingDocument, setEditingDocument] = useState<OfferDocument | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        const areaResult = await getLatestParcelArea(projectId);
        if (!active) return;
        setFootprintArea(areaResult.footprintArea);
        setFloorAreas(areaResult.floorAreas);
        setParcelCalculationId(areaResult.parcelCalculationId);
      } catch (error) {
        if (active) showError(getErrorMessage(error, 'Teklif dokümanları yüklenemedi'));
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [projectId]);

  useEffect(() => {
    getCompaniesApi().then((companies) => {
      setCompanyName(companies[0]?.name ?? '');
    }).catch(() => undefined);
  }, []);

  const saveDocument = async (payload: OfferDocumentPayload, documentId?: string): Promise<OfferDocument> => {
    const saved = documentId
      ? await updateOfferDocument(projectId, documentId, payload)
      : await createOfferDocument(projectId, payload);
    setEditingDocument(saved);
    showSuccess('Teklif dokümanı kaydedildi');
    return saved;
  };

  const downloadPdf = async (documentId: string) => {
    try {
      const blob = await downloadOfferPdf(projectId, documentId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (error) {
      showError(getErrorMessage(error, 'PDF oluşturulamadı'));
    }
  };

  if (loading) {
    return (
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
        <Notification {...notificationProps} />
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {editingDocument ? 'Teklif Düzenle' : 'Yeni Teklif Oluştur'}
        </Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
          Dinamik PDF inşaat yapım teklifleri
        </Typography>
      </Box>

      {formOpen ? (
        <OfferForm
          initialDocument={editingDocument}
          parcelArea={footprintArea}
          floorAreas={floorAreas}
          companyName={companyName}
          parcelCalculationId={parcelCalculationId}
          onSave={saveDocument}
          onGeneratePdf={downloadPdf}
        />
      ) : null}

      <Notification {...notificationProps} />
    </Stack>
  );
}
