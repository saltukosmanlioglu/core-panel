'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  Box,
  Card,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  AutoAwesome as AutoAwesomeIcon,
  Delete as DeleteIcon,
  UploadFile as UploadFileIcon,
} from '@mui/icons-material';
import { ConfirmationDialog, Notification } from '@/components';
import { FormButton } from '@/components/form-elements';
import { getTenantsApi } from '@/services/admin/api';
import { getTenderInvitations, updateTenderInvitations } from '@/services/tender-invitations/api';
import { getTenderOfferFiles, uploadTenderOfferFile, deleteTenderOfferFile } from '@/services/tender-offer-files/api';
import { runTenderComparison } from '@/services/tender-comparisons/api';
import { getTenderApi } from '@/services/workspace/api';
import type { Tender, Tenant, TenderOfferFile } from '@core-panel/shared';

function getErrorMessage(error: unknown, fallback: string): string {
  return axios.isAxiosError(error)
    ? ((error.response?.data as { error?: string })?.error ?? fallback)
    : fallback;
}

export default function AdminTenderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [tender, setTender] = useState<Tender | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [offerFiles, setOfferFiles] = useState<TenderOfferFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingInvitations, setSavingInvitations] = useState(false);
  const [runningComparison, setRunningComparison] = useState(false);
  const [uploadingTenantId, setUploadingTenantId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TenderOfferFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });

  const loadPage = async () => {
    try {
      setLoading(true);
      const [tenderData, tenantData, invitationData, offerFileData] = await Promise.all([
        getTenderApi(id),
        getTenantsApi(),
        getTenderInvitations(id),
        getTenderOfferFiles(id),
      ]);

      setTender(tenderData);
      setTenants(tenantData);
      setSelectedTenantIds(invitationData.tenantIds);
      setOfferFiles(offerFileData);
    } catch (error) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'İhale detayları yüklenemedi'),
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPage();
  }, [id]);

  const invitedTenants = useMemo(
    () => tenants.filter((tenant) => selectedTenantIds.includes(tenant.id)),
    [selectedTenantIds, tenants],
  );

  const offerFileMap = useMemo(
    () => new Map(offerFiles.map((offerFile) => [offerFile.tenantId, offerFile])),
    [offerFiles],
  );

  const uploadedInvitedFileCount = invitedTenants.filter((tenant) => offerFileMap.has(tenant.id)).length;

  const toggleTenant = (tenantId: string) => {
    setSelectedTenantIds((current) =>
      current.includes(tenantId)
        ? current.filter((idValue) => idValue !== tenantId)
        : [...current, tenantId],
    );
  };

  const handleSaveInvitations = async () => {
    try {
      setSavingInvitations(true);
      const response = await updateTenderInvitations(id, selectedTenantIds);
      setSelectedTenantIds(response.tenantIds);
      setSnackbar({ open: true, message: 'Davetli firmalar güncellendi', severity: 'success' });
    } catch (error) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'Davetler güncellenemedi'),
        severity: 'error',
      });
    } finally {
      setSavingInvitations(false);
    }
  };

  const handleUpload = async (tenantId: string, file: File | null) => {
    if (!file) {
      return;
    }

    try {
      setUploadingTenantId(tenantId);
      const uploaded = await uploadTenderOfferFile(id, tenantId, file);
      setOfferFiles((current) => {
        const next = current.filter((offerFile) => offerFile.tenantId !== tenantId);
        return [...next, uploaded].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
      });
      setSnackbar({ open: true, message: 'Teklif dosyası yüklendi', severity: 'success' });
    } catch (error) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'Teklif dosyası yüklenemedi'),
        severity: 'error',
      });
    } finally {
      setUploadingTenantId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      setDeleting(true);
      await deleteTenderOfferFile(id, deleteTarget.tenantId);
      setOfferFiles((current) => current.filter((offerFile) => offerFile.tenantId !== deleteTarget.tenantId));
      setSnackbar({ open: true, message: 'Teklif dosyası silindi', severity: 'success' });
      setDeleteTarget(null);
    } catch (error) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'Teklif dosyası silinemedi'),
        severity: 'error',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleRunComparison = async () => {
    try {
      setRunningComparison(true);
      await runTenderComparison(id);
      router.push(`/admin/tenders/${id}/offers`);
    } catch (error) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'Karşılaştırma başlatılamadı'),
        severity: 'error',
      });
    } finally {
      setRunningComparison(false);
    }
  };

  return (
    <Box>
      <Box className="flex items-center gap-2 mb-4">
        <FormButton
          variant="ghost"
          size="sm"
          startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
          onClick={() => router.push('/admin/tenders')}
        >
          Geri
        </FormButton>
      </Box>

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        {loading ? 'İhale Yükleniyor...' : tender?.title ?? 'İhale'}
      </Typography>
      <Typography variant="body2" sx={{ color: '#6B7280', mb: 4 }}>
        İhale davetlerini, teklif dosyalarını ve AI karşılaştırmasını yönetin
      </Typography>

      <Card sx={{ p: 4, mb: 4 }}>
        {loading ? (
          <Box className="flex justify-center py-8">
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gap: 1.5 }}>
            <Typography variant="body2" sx={{ color: '#6B7280' }}>
              <strong>İnşaat:</strong> {tender?.projectName ?? '—'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280' }}>
              <strong>Durum:</strong> {tender?.status ?? '—'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280' }}>
              <strong>Son Tarih:</strong> {tender?.deadline ? new Date(tender.deadline).toLocaleString('tr-TR') : '—'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280' }}>
              <strong>Açıklama:</strong> {tender?.description ?? 'Açıklama girilmemiş'}
            </Typography>
          </Box>
        )}
      </Card>

      <Card sx={{ p: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
              Davetli Firmalar
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280' }}>
              Teklif yükleyebilecek firmaları seçin
            </Typography>
          </Box>
          <FormButton variant="primary" size="sm" onClick={handleSaveInvitations} loading={savingInvitations}>
            Kaydet
          </FormButton>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <Box sx={{ display: 'grid', gap: 1 }}>
          {tenants.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#6B7280' }}>
              Bu şirkete ait kayıtlı taşeron bulunmuyor.
            </Typography>
          ) : (
            tenants.map((tenant) => (
              <FormControlLabel
                key={tenant.id}
                control={<Checkbox checked={selectedTenantIds.includes(tenant.id)} onChange={() => toggleTenant(tenant.id)} />}
                label={tenant.name}
              />
            ))
          )}
        </Box>
      </Card>

      <Card sx={{ p: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
              Teklif Dosyaları
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280' }}>
              Her davetli firma için tek dosya yükleyin
            </Typography>
          </Box>
          <FormButton
            variant="secondary"
            size="sm"
            startIcon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
            onClick={handleRunComparison}
            loading={runningComparison}
            disabled={uploadedInvitedFileCount < 2}
          >
            AI Karşılaştırmasını Çalıştır
          </FormButton>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#F9FAFB' }}>
                <TableCell sx={{ fontWeight: 700 }}>Firma</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Dosya</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Yüklenme Tarihi</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 220 }}>İşlemler</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invitedTenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" sx={{ color: '#6B7280' }}>
                      Önce davetli firma seçin.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                invitedTenants.map((tenant) => {
                  const offerFile = offerFileMap.get(tenant.id) ?? null;
                  const isUploading = uploadingTenantId === tenant.id;

                  return (
                    <TableRow key={tenant.id}>
                      <TableCell>{tenant.name}</TableCell>
                      <TableCell>{offerFile?.originalName ?? 'Dosya yok'}</TableCell>
                      <TableCell>
                        {offerFile?.createdAt ? new Date(offerFile.createdAt).toLocaleString('tr-TR') : '—'}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <input
                            id={`offer-file-${tenant.id}`}
                            type="file"
                            accept=".xlsx,.xls,.pdf,.doc,.docx"
                            hidden
                            onChange={(event) => {
                              const file = event.target.files?.[0] ?? null;
                              void handleUpload(tenant.id, file);
                              event.target.value = '';
                            }}
                          />
                          <FormButton
                            variant="secondary"
                            size="sm"
                            startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}
                            onClick={() => document.getElementById(`offer-file-${tenant.id}`)?.click()}
                            loading={isUploading}
                          >
                            {offerFile ? 'Değiştir' : 'Yükle'}
                          </FormButton>
                          {offerFile && (
                            <FormButton
                              variant="danger"
                              size="sm"
                              startIcon={<DeleteIcon sx={{ fontSize: 16 }} />}
                              onClick={() => setDeleteTarget(offerFile)}
                            >
                              Sil
                            </FormButton>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Teklif Dosyasını Sil"
        description={`"${deleteTarget?.tenantName ?? 'Firma'}" için yüklenen dosyayı silmek istediğinize emin misiniz?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
        confirmLabel="Sil"
      />
      <Notification
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar((current) => ({ ...current, open: false }))}
      />
    </Box>
  );
}
