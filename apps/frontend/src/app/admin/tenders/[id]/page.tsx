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
  const [deletingTenantId, setDeletingTenantId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });

  const loadOfferFiles = async () => {
    const offerFileData = await getTenderOfferFiles(id);
    setOfferFiles(offerFileData);
  };

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

  const canRunComparison = offerFiles.length >= 2;

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
      await loadOfferFiles();
      setSnackbar({ open: true, message: 'Invitations saved', severity: 'success' });
    } catch (error) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'Invitations could not be saved'),
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
      await uploadTenderOfferFile(id, tenantId, file);
      await loadOfferFiles();
      setSnackbar({ open: true, message: 'File uploaded successfully', severity: 'success' });
    } catch (error) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'File upload failed'),
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
      setDeletingTenantId(deleteTarget.tenantId);
      await deleteTenderOfferFile(id, deleteTarget.tenantId);
      await loadOfferFiles();
      setSnackbar({ open: true, message: 'File deleted', severity: 'success' });
      setDeleteTarget(null);
    } catch (error) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'File deletion failed'),
        severity: 'error',
      });
    } finally {
      setDeletingTenantId(null);
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
        message: getErrorMessage(error, 'AI comparison could not be run'),
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
              Invited Tenants
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280' }}>
              Teklif yükleyebilecek firmaları seçin
            </Typography>
          </Box>
          <FormButton variant="primary" size="sm" onClick={handleSaveInvitations} loading={savingInvitations}>
            Save Invitations
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

      {invitedTenants.length > 0 && (
        <Card sx={{ p: 4, mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'flex-start', mb: 3 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                Offer Files
              </Typography>
              <Typography variant="body2" sx={{ color: '#6B7280' }}>
                Upload one file per invited tenant
              </Typography>
            </Box>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#F9FAFB' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Tenant Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>File</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Uploaded At</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 220 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invitedTenants.map((tenant) => {
                  const offerFile = offerFileMap.get(tenant.id) ?? null;
                  const isUploading = uploadingTenantId === tenant.id;
                  const isDeleting = deletingTenantId === tenant.id;

                  return (
                    <TableRow key={tenant.id}>
                      <TableCell>{tenant.name}</TableCell>
                      <TableCell>{offerFile?.originalName ?? 'No file'}</TableCell>
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
                            disabled={isDeleting}
                          >
                            {offerFile ? 'Replace' : 'Upload'}
                          </FormButton>
                          {offerFile && (
                            <FormButton
                              variant="danger"
                              size="sm"
                              startIcon={<DeleteIcon sx={{ fontSize: 16 }} />}
                              onClick={() => setDeleteTarget(offerFile)}
                              loading={isDeleting}
                              disabled={isUploading}
                            >
                              Delete
                            </FormButton>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
        <FormButton
          variant="primary"
          size="md"
          startIcon={runningComparison ? undefined : <AutoAwesomeIcon sx={{ fontSize: 18 }} />}
          onClick={handleRunComparison}
          loading={runningComparison}
          disabled={!canRunComparison}
        >
          Run AI Comparison
        </FormButton>
      </Box>

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Delete File"
        description="Are you sure you want to delete this file?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteTarget ? deletingTenantId === deleteTarget.tenantId : false}
        confirmLabel="Delete"
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
