'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import { Notification } from '@/components';
import { useSnackbar } from '@/hooks/useSnackbar';
import {
  createOfferDocument,
  deleteOfferDocument,
  downloadOfferPdf,
  getLatestParcelArea,
  getOfferDocuments,
  updateOfferDocument,
} from '@/services/offer-documents/api';
import type {
  OfferDocument,
  OfferDocumentPayload,
} from '@/services/offer-documents/types';
import { getCompaniesApi } from '@/services/admin/api';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { OfferForm } from './offer-form/offer-form';

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function OfferDocumentsPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = String(id);
  const { showSuccess, showError, notificationProps } = useSnackbar();
  const [offerDocuments, setOfferDocuments] = useState<OfferDocument[]>([]);
  const [parcelArea, setParcelArea] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<OfferDocument | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        const [documents, area] = await Promise.all([
          getOfferDocuments(projectId),
          getLatestParcelArea(projectId),
        ]);
        if (!active) return;
        setOfferDocuments(documents);
        setParcelArea(area);
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

  const openCreate = () => {
    setEditingDocument(null);
    setFormOpen(true);
  };

  const saveDocument = async (payload: OfferDocumentPayload, documentId?: string): Promise<OfferDocument> => {
    const saved = documentId
      ? await updateOfferDocument(projectId, documentId, payload)
      : await createOfferDocument(projectId, payload);
    setOfferDocuments((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
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

  const removeDocument = async (documentId: string) => {
    try {
      await deleteOfferDocument(projectId, documentId);
      setOfferDocuments((current) => current.filter((item) => item.id !== documentId));
      showSuccess('Teklif dokümanı silindi');
    } catch (error) {
      showError(getErrorMessage(error, 'Teklif dokümanı silinemedi'));
    }
  };

  if (formOpen) {
    return (
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            variant="text"
            onClick={() => setFormOpen(false)}
            sx={{ mr: 1 }}
          >
            Geri
          </Button>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {editingDocument ? 'Teklif Düzenle' : 'Yeni Teklif Oluştur'}
          </Typography>
        </Box>
        <OfferForm
          initialDocument={editingDocument}
          parcelArea={parcelArea}
          companyName={companyName}
          onCancel={() => setFormOpen(false)}
          onSave={saveDocument}
          onGeneratePdf={downloadPdf}
        />
        <Notification {...notificationProps} />
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Teklif Oluştur
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
            Dinamik PDF inşaat yapım teklifleri
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Yeni Teklif Oluştur
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : offerDocuments.length === 0 ? (
        <Box sx={{ border: '1px dashed #cbd5e1', borderRadius: 1, p: 4, textAlign: 'center' }}>
          <Typography sx={{ fontWeight: 700 }}>Henüz teklif dokümanı yok.</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 13, mt: 0.5 }}>
            İlk PDF teklifinizi oluşturmak için yeni teklif düğmesini kullanın.
          </Typography>
        </Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Parsel Başlığı</TableCell>
              <TableCell>Teklif Tarihi</TableCell>
              <TableCell align="right">İşlemler</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {offerDocuments.map((document) => (
              <TableRow key={document.id}>
                <TableCell>
                  <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{document.parcelTitle}</Typography>
                </TableCell>
                <TableCell>{formatDate(document.offerDate)}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Düzenle">
                    <IconButton onClick={() => { setEditingDocument(document); setFormOpen(true); }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="PDF indir">
                    <IconButton onClick={() => void downloadPdf(document.id)}>
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Sil">
                    <IconButton color="error" onClick={() => void removeDocument(document.id)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Notification {...notificationProps} />
    </Stack>
  );
}
