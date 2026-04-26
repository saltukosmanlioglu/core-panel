'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  Box,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  AutoAwesome as AutoAwesomeIcon,
  CalendarMonth as CalendarMonthIcon,
  Construction as ConstructionIcon,
  Delete as DeleteIcon,
  DescriptionOutlined as DescriptionOutlinedIcon,
  FolderOpenOutlined as FolderOpenOutlinedIcon,
  InsertDriveFileOutlined as InsertDriveFileOutlinedIcon,
  PictureAsPdfOutlined as PictureAsPdfOutlinedIcon,
  TableChartOutlined as TableChartOutlinedIcon,
  UploadFile as UploadFileIcon,
  BusinessOutlined as BusinessOutlinedIcon,
} from '@mui/icons-material';
import { ConfirmationDialog, Notification } from '@/components';
import { FormButton } from '@/components/form-elements';
import { getTenantsApi } from '@/services/admin/api';
import { getTenderInvitations, updateTenderInvitations } from '@/services/tender-invitations/api';
import { getTenderOfferFiles, uploadTenderOfferFile, deleteTenderOfferFile } from '@/services/tender-offer-files/api';
import { runTenderComparison } from '@/services/tender-comparisons/api';
import { getTenderApi } from '@/services/workspace/api';
import type { Tender, Tenant, TenderOfferFile } from '@core-panel/shared';

const COLORS = {
  primaryNavy: '#0f172a',
  accentBlue: '#3b82f6',
  successGreen: '#16a34a',
  warningOrange: '#ea580c',
  dangerRed: '#dc2626',
  surface: '#f8fafc',
  border: '#e2e8f0',
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  white: '#ffffff',
};

const WORKFLOW_STEPS = [
  'Taşeronları Davet Et',
  'Teklifleri Yükle',
  'Karşılaştır',
  'İhaleyi Değerlendir',
];

function getErrorMessage(error: unknown, fallback: string): string {
  return axios.isAxiosError(error)
    ? ((error.response?.data as { error?: string })?.error ?? fallback)
    : fallback;
}

function formatDate(value?: string | null): string {
  return value ? new Date(value).toLocaleDateString('tr-TR') : '—';
}

function formatDateTime(value?: string | null): string {
  return value ? new Date(value).toLocaleString('tr-TR') : '—';
}

function getStatusConfig(status?: string) {
  switch (status) {
    case 'open':
      return { label: 'Açık', color: COLORS.accentBlue, backgroundColor: '#dbeafe' };
    case 'closed':
      return { label: 'Kapalı', color: COLORS.warningOrange, backgroundColor: '#ffedd5' };
    case 'awarded':
      return { label: 'Atandı', color: COLORS.successGreen, backgroundColor: '#dcfce7' };
    case 'draft':
    default:
      return { label: 'Taslak', color: COLORS.textSecondary, backgroundColor: '#e2e8f0' };
  }
}

function getWorkflowStep(invitationCount: number, uploadedCount: number, tenderStatus?: string): number {
  if (tenderStatus === 'awarded') {
    return 3;
  }

  if (uploadedCount > 0) {
    return 2;
  }

  if (invitationCount > 0) {
    return 1;
  }

  return 0;
}

function getFileVisual(offerFile: TenderOfferFile | null) {
  if (!offerFile) {
    return {
      icon: <InsertDriveFileOutlinedIcon sx={{ fontSize: 20 }} />,
      iconBackground: '#e2e8f0',
      iconColor: COLORS.textSecondary,
    };
  }

  const mimeType = offerFile.mimeType;

  if (mimeType === 'application/pdf') {
    return {
      icon: <PictureAsPdfOutlinedIcon sx={{ fontSize: 20 }} />,
      iconBackground: '#fee2e2',
      iconColor: COLORS.dangerRed,
    };
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel'
  ) {
    return {
      icon: <TableChartOutlinedIcon sx={{ fontSize: 20 }} />,
      iconBackground: '#dcfce7',
      iconColor: COLORS.successGreen,
    };
  }

  return {
    icon: <DescriptionOutlinedIcon sx={{ fontSize: 20 }} />,
    iconBackground: '#dbeafe',
    iconColor: COLORS.accentBlue,
  };
}

function DetailRow(props: {
  icon: JSX.Element;
  label: string;
  value: string;
}) {
  const { icon, label, value } = props;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        p: 1.5,
        borderRadius: 2,
        backgroundColor: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: '12px',
          backgroundColor: '#e2e8f0',
          color: COLORS.primaryNavy,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: COLORS.textSecondary, display: 'block', mb: 0.25 }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ color: COLORS.textPrimary, fontWeight: 600, wordBreak: 'break-word' }}>
          {value}
        </Typography>
      </Box>
    </Box>
  );
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

  const uninvitedTenants = useMemo(
    () => tenants.filter((tenant) => !selectedTenantIds.includes(tenant.id)),
    [selectedTenantIds, tenants],
  );

  const offerFileMap = useMemo(
    () => new Map(offerFiles.map((offerFile) => [offerFile.tenantId, offerFile])),
    [offerFiles],
  );

  const canRunComparison = offerFiles.length >= 2;
  const statusConfig = getStatusConfig(tender?.status);
  const workflowStep = getWorkflowStep(invitedTenants.length, offerFiles.length, tender?.status);
  const uploadedFileCount = invitedTenants.filter((tenant) => offerFileMap.has(tenant.id)).length;
  const totalInviteTargets = invitedTenants.length;
  const workflowSummaryText = `${uploadedFileCount}/${Math.max(totalInviteTargets, 0)} dosya yüklendi`;

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
    <Box sx={{ backgroundColor: COLORS.surface, minHeight: '100%', p: { xs: 2, md: 3 } }}>
      <Stack spacing={3}>
        <Box
          sx={{
            p: { xs: 2.5, md: 3 },
            borderRadius: 3,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: COLORS.white,
            boxShadow: '0 24px 48px rgba(15, 23, 42, 0.18)',
          }}
        >
          <FormButton
            variant="ghost"
            size="sm"
            startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
            onClick={() => router.push('/admin/tenders')}
            sx={{
              color: COLORS.white,
              px: 0,
              mb: 3,
              justifyContent: 'flex-start',
              '&:hover': { backgroundColor: 'transparent', color: '#bfdbfe' },
            }}
          >
            Geri
          </FormButton>

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 2,
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: { xs: 'flex-start', md: 'center' },
            }}
          >
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '18px',
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ConstructionIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.15, mb: 0.75, fontSize: { xs: 28, md: 34 } }}>
                  {loading ? 'İhale Yükleniyor...' : tender?.title ?? 'İhale'}
                </Typography>
                <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.78)' }}>
                  {(tender?.projectName ?? 'Proje bilgisi yok')} • Son Tarih: {formatDate(tender?.deadline)}
                </Typography>
              </Box>
            </Box>

            <Chip
              label={`Durum: ${statusConfig.label}`}
              sx={{
                height: 36,
                borderRadius: '999px',
                px: 1,
                fontWeight: 700,
                color: statusConfig.color,
                backgroundColor: statusConfig.backgroundColor,
                border: '1px solid rgba(255,255,255,0.14)',
                '& .MuiChip-label': { px: 1.25 },
              }}
            />
          </Box>
        </Box>

        <Card
          sx={{
            borderRadius: 3,
            border: `1px solid ${COLORS.border}`,
            boxShadow: '0 12px 30px rgba(15, 23, 42, 0.06)',
          }}
        >
          <CardContent sx={{ p: { xs: 2, md: 3 }, '&:last-child': { pb: { xs: 2, md: 3 } } }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: COLORS.textPrimary, mb: 0.5 }}>
              İhale İş Akışı
            </Typography>
            <Typography variant="body2" sx={{ color: COLORS.textSecondary, mb: 3 }}>
              Davet, dosya yükleme, karşılaştırma ve değerlendirme adımlarını tek ekranda takip edin.
            </Typography>

            <Stepper
              alternativeLabel
              activeStep={workflowStep}
              sx={{
                '& .MuiStepLabel-label': { color: COLORS.textSecondary, fontWeight: 600, mt: 0.75 },
                '& .MuiStepLabel-label.Mui-active': { color: COLORS.accentBlue },
                '& .MuiStepLabel-label.Mui-completed': { color: COLORS.successGreen },
                '& .MuiStepIcon-root': { color: '#cbd5e1' },
                '& .MuiStepIcon-root.Mui-active': { color: COLORS.accentBlue },
                '& .MuiStepIcon-root.Mui-completed': { color: COLORS.successGreen },
                '& .MuiStepConnector-line': { borderColor: COLORS.border },
              }}
            >
              {WORKFLOW_STEPS.map((step, index) => (
                <Step
                  key={step}
                  completed={tender?.status === 'awarded' ? true : index < workflowStep}
                >
                  <StepLabel>{step}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </CardContent>
        </Card>

        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: '1fr', md: 'minmax(320px, 0.95fr) minmax(420px, 1.45fr)' },
            alignItems: 'start',
          }}
        >
          <Stack spacing={3}>
            <Card
              sx={{
                borderRadius: 3,
                border: `1px solid ${COLORS.border}`,
                boxShadow: '0 12px 30px rgba(15, 23, 42, 0.06)',
              }}
            >
              <CardContent sx={{ p: { xs: 2, md: 3 }, '&:last-child': { pb: { xs: 2, md: 3 } } }}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: COLORS.textPrimary, mb: 2.5 }}>
                  İhale Bilgileri
                </Typography>

                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress size={28} />
                  </Box>
                ) : (
                  <Stack spacing={1.5}>
                    <DetailRow
                      icon={<BusinessOutlinedIcon sx={{ fontSize: 18 }} />}
                      label="İnşaat"
                      value={tender?.projectName ?? '—'}
                    />
                    <DetailRow
                      icon={<CalendarMonthIcon sx={{ fontSize: 18 }} />}
                      label="Son Tarih"
                      value={formatDate(tender?.deadline)}
                    />
                    <DetailRow
                      icon={<DescriptionOutlinedIcon sx={{ fontSize: 18 }} />}
                      label="Açıklama"
                      value={tender?.description ?? '—'}
                    />
                    <DetailRow
                      icon={<FolderOpenOutlinedIcon sx={{ fontSize: 18 }} />}
                      label="Durum"
                      value={statusConfig.label}
                    />
                  </Stack>
                )}
              </CardContent>
            </Card>

            <Card
              sx={{
                borderRadius: 3,
                border: `1px solid ${COLORS.border}`,
                boxShadow: '0 12px 30px rgba(15, 23, 42, 0.06)',
              }}
            >
              <CardContent sx={{ p: { xs: 2, md: 3 }, '&:last-child': { pb: { xs: 2, md: 3 } } }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 2,
                    mb: 2.5,
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 800, color: COLORS.textPrimary }}>
                    Davet Edilen Taşeronlar
                  </Typography>
                  <Chip
                    label={invitedTenants.length}
                    size="small"
                    sx={{
                      backgroundColor: '#dbeafe',
                      color: COLORS.accentBlue,
                      fontWeight: 800,
                    }}
                  />
                </Box>

                {tenants.length === 0 ? (
                  <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
                    Bu şirkete ait kayıtlı taşeron bulunmuyor.
                  </Typography>
                ) : (
                  <Stack spacing={2}>
                    <Box sx={{ display: 'grid', gap: 0.75 }}>
                      {invitedTenants.map((tenant) => (
                        <Paper
                          key={tenant.id}
                          variant="outlined"
                          sx={{
                            borderRadius: 2,
                            borderColor: COLORS.border,
                            backgroundColor: '#f8fafc',
                            px: 1.25,
                            py: 0.5,
                          }}
                        >
                          <FormControlLabel
                            control={(
                              <Checkbox
                                checked={selectedTenantIds.includes(tenant.id)}
                                onChange={() => toggleTenant(tenant.id)}
                                sx={{
                                  color: COLORS.accentBlue,
                                  '&.Mui-checked': { color: COLORS.accentBlue },
                                }}
                              />
                            )}
                            label={tenant.name}
                            sx={{
                              m: 0,
                              width: '100%',
                              '& .MuiFormControlLabel-label': {
                                fontWeight: 600,
                                color: COLORS.textPrimary,
                              },
                            }}
                          />
                        </Paper>
                      ))}
                    </Box>

                    {invitedTenants.length > 0 && uninvitedTenants.length > 0 ? (
                      <Divider sx={{ borderColor: COLORS.border }} />
                    ) : null}

                    <Box sx={{ display: 'grid', gap: 0.75 }}>
                      {uninvitedTenants.map((tenant) => (
                        <Paper
                          key={tenant.id}
                          variant="outlined"
                          sx={{
                            borderRadius: 2,
                            borderColor: COLORS.border,
                            backgroundColor: COLORS.white,
                            px: 1.25,
                            py: 0.5,
                          }}
                        >
                          <FormControlLabel
                            control={(
                              <Checkbox
                                checked={selectedTenantIds.includes(tenant.id)}
                                onChange={() => toggleTenant(tenant.id)}
                                sx={{
                                  color: '#94a3b8',
                                  '&.Mui-checked': { color: COLORS.accentBlue },
                                }}
                              />
                            )}
                            label={tenant.name}
                            sx={{
                              m: 0,
                              width: '100%',
                              '& .MuiFormControlLabel-label': {
                                fontWeight: 500,
                                color: COLORS.textPrimary,
                              },
                            }}
                          />
                        </Paper>
                      ))}
                    </Box>

                    <FormButton
                      variant="primary"
                      size="md"
                      fullWidth
                      onClick={handleSaveInvitations}
                      loading={savingInvitations}
                      sx={{
                        mt: 1,
                        backgroundColor: COLORS.primaryNavy,
                        '&:hover': { backgroundColor: '#111827' },
                      }}
                    >
                      Davetleri Kaydet
                    </FormButton>
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Stack>

          <Stack spacing={3}>
            <Card
              sx={{
                borderRadius: 3,
                border: `1px solid ${COLORS.border}`,
                boxShadow: '0 12px 30px rgba(15, 23, 42, 0.06)',
              }}
            >
              <CardContent sx={{ p: { xs: 2, md: 3 }, '&:last-child': { pb: { xs: 2, md: 3 } } }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 2,
                    flexWrap: 'wrap',
                    mb: 1,
                  }}
                >
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: COLORS.textPrimary, mb: 0.5 }}>
                      Teklif Dosyaları
                    </Typography>
                    <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
                      Davet edilen her taşeron için bir dosya yükleyin.
                    </Typography>
                  </Box>
                  <Chip
                    label={`${uploadedFileCount}/${totalInviteTargets}`}
                    sx={{
                      backgroundColor: '#eff6ff',
                      color: COLORS.accentBlue,
                      fontWeight: 800,
                    }}
                  />
                </Box>

                <Stack spacing={1.5} sx={{ mt: 3 }}>
                  {invitedTenants.length === 0 ? (
                    <Paper
                      variant="outlined"
                      sx={{
                        borderRadius: 3,
                        borderStyle: 'dashed',
                        borderColor: COLORS.border,
                        backgroundColor: COLORS.surface,
                        p: 3,
                      }}
                    >
                      <Typography variant="body1" sx={{ fontWeight: 700, color: COLORS.textPrimary, mb: 0.75 }}>
                        Henüz davet edilen taşeron yok
                      </Typography>
                      <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
                        Dosya yükleme alanı, en az bir taşeron davet edildiğinde kullanılabilir.
                      </Typography>
                    </Paper>
                  ) : (
                    invitedTenants.map((tenant) => {
                      const offerFile = offerFileMap.get(tenant.id) ?? null;
                      const isUploading = uploadingTenantId === tenant.id;
                      const isDeleting = deletingTenantId === tenant.id;
                      const fileVisual = getFileVisual(offerFile);

                      return (
                        <Paper
                          key={tenant.id}
                          variant="outlined"
                          sx={{
                            p: 2,
                            borderRadius: 3,
                            borderColor: offerFile ? '#bfdbfe' : COLORS.border,
                            borderStyle: offerFile ? 'solid' : 'dashed',
                            backgroundColor: offerFile ? COLORS.white : '#fbfdff',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: 2,
                              flexDirection: { xs: 'column', sm: 'row' },
                            }}
                          >
                            <Box sx={{ display: 'flex', gap: 1.5, minWidth: 0 }}>
                              <Box
                                sx={{
                                  width: 48,
                                  height: 48,
                                  borderRadius: '16px',
                                  backgroundColor: fileVisual.iconBackground,
                                  color: fileVisual.iconColor,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                {fileVisual.icon}
                              </Box>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body1" sx={{ fontWeight: 700, color: COLORS.textPrimary, mb: 0.25 }}>
                                  {tenant.name}
                                </Typography>
                                <Typography variant="body2" sx={{ color: COLORS.textSecondary, wordBreak: 'break-word', mb: 0.35 }}>
                                  {offerFile?.originalName ?? 'Dosya yüklenmedi'}
                                </Typography>
                                <Typography variant="caption" sx={{ color: COLORS.textSecondary }}>
                                  {offerFile?.createdAt ? formatDateTime(offerFile.createdAt) : 'Henüz yükleme yapılmadı'}
                                </Typography>
                              </Box>
                            </Box>

                            <Box
                              sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: { xs: 'stretch', sm: 'flex-end' },
                                justifyContent: 'space-between',
                                gap: 1.5,
                              }}
                            >
                              {offerFile ? (
                                <Chip
                                  label="Yüklendi"
                                  size="small"
                                  sx={{
                                    alignSelf: { xs: 'flex-start', sm: 'flex-end' },
                                    backgroundColor: '#dcfce7',
                                    color: COLORS.successGreen,
                                    fontWeight: 800,
                                  }}
                                />
                              ) : (
                                <Chip
                                  label="Bekleniyor"
                                  size="small"
                                  sx={{
                                    alignSelf: { xs: 'flex-start', sm: 'flex-end' },
                                    backgroundColor: '#e2e8f0',
                                    color: COLORS.textSecondary,
                                    fontWeight: 700,
                                  }}
                                />
                              )}

                              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: { sm: 'flex-end' } }}>
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
                                  sx={{
                                    borderColor: COLORS.accentBlue,
                                    color: COLORS.accentBlue,
                                    '&:hover': {
                                      borderColor: COLORS.accentBlue,
                                      backgroundColor: '#eff6ff',
                                    },
                                  }}
                                >
                                  {offerFile ? 'Değiştir' : 'Yükle'}
                                </FormButton>
                                {offerFile ? (
                                  <FormButton
                                    variant="danger"
                                    size="sm"
                                    startIcon={<DeleteIcon sx={{ fontSize: 16 }} />}
                                    onClick={() => setDeleteTarget(offerFile)}
                                    loading={isDeleting}
                                    disabled={isUploading}
                                    sx={{
                                      backgroundColor: COLORS.dangerRed,
                                      '&:hover': { backgroundColor: '#b91c1c' },
                                    }}
                                  >
                                    Sil
                                  </FormButton>
                                ) : null}
                              </Box>
                            </Box>
                          </Box>
                        </Paper>
                      );
                    })
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Card
              sx={{
                borderRadius: 3,
                border: `1px solid ${COLORS.border}`,
                boxShadow: '0 12px 30px rgba(15, 23, 42, 0.06)',
                position: { md: 'sticky', xs: 'static' },
                top: { md: 24 },
              }}
            >
              <CardContent sx={{ p: { xs: 2, md: 3 }, '&:last-child': { pb: { xs: 2, md: 3 } } }}>
                <Typography variant="body1" sx={{ fontWeight: 800, color: COLORS.textPrimary, mb: 0.5 }}>
                  {workflowSummaryText}
                </Typography>
                <Typography variant="body2" sx={{ color: COLORS.textSecondary, mb: 2.5 }}>
                  Karşılaştırmayı başlatmak için en az 2 dosya gereklidir.
                </Typography>

                <Tooltip title={canRunComparison ? '' : 'Karşılaştırma için en az 2 dosya yüklenmelidir'}>
                  <Box component="span" sx={{ display: 'block' }}>
                    <FormButton
                      variant="primary"
                      size="lg"
                      fullWidth
                      startIcon={runningComparison ? undefined : <AutoAwesomeIcon sx={{ fontSize: 18 }} />}
                      onClick={handleRunComparison}
                      loading={runningComparison}
                      disabled={!canRunComparison}
                      sx={{
                        backgroundColor: COLORS.primaryNavy,
                        '&:hover': { backgroundColor: '#111827' },
                        '&:disabled': { backgroundColor: '#cbd5e1', color: '#94a3b8' },
                      }}
                    >
                      AI Karşılaştırması Çalıştır
                    </FormButton>
                  </Box>
                </Tooltip>
              </CardContent>
            </Card>
          </Stack>
        </Box>
      </Stack>

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
