'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  Apartment as ApartmentIcon,
  ArrowForward as ArrowForwardIcon,
  Badge as BadgeIcon,
  Business as BusinessIcon,
  CheckCircle as CheckCircleIcon,
  Construction as ConstructionIcon,
  Edit as EditIcon,
  Error as ErrorIcon,
  Gavel as GavelIcon,
  Inventory2 as Inventory2Icon,
  People as PeopleIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { Notification } from '@/components';
import { FormButton } from '@/components/form-elements';
import { TenderStatusChip } from '@/components/tender-status-chip';
import { getCompaniesApi, getStatsApi, reprovisionCompanySchemaApi } from '@/services/admin/api';
import { getTendersApi } from '@/services/workspace/api';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { useSnackbar } from '@/hooks/useSnackbar';
import type { AdminStats } from '@/services/admin/types';
import type { Company, Tender } from '@core-panel/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function formatLongDate(value?: string | null): string {
  return value
    ? new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
}

function formatShortDate(value?: string | null): string {
  return value ? new Date(value).toLocaleDateString('tr-TR') : '—';
}

function StatCard({
  value,
  label,
  icon,
  color,
  href,
}: {
  value: number;
  label: string;
  icon: React.ReactNode;
  color: string;
  href: string;
}) {
  const router = useRouter();

  return (
    <Card
      onClick={() => router.push(href)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') router.push(href);
      }}
      sx={{
        borderRadius: '6px',
        borderLeft: `4px solid ${color}`,
        backgroundColor: `${color}0d`,
        boxShadow: '0 8px 20px rgba(15, 23, 42, 0.06)',
        cursor: 'pointer',
        transition: 'transform 0.16s ease, box-shadow 0.16s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 14px 28px rgba(15, 23, 42, 0.10)',
        },
      }}
    >
      <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 30, lineHeight: 1, fontWeight: 800, color, mb: 0.75 }}>
              {value.toLocaleString('tr-TR')}
            </Typography>
            <Typography sx={{ fontSize: 13, color: '#6B7280', fontWeight: 600 }}>
              {label}
            </Typography>
          </Box>
          <Box sx={{ color, mt: 0.25 }}>{icon}</Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function CompaniesPage() {
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentTenders, setRecentTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [reprovisioning, setReprovisioning] = useState(false);
  const { showSuccess, showError, notificationProps } = useSnackbar();
  const logoUrl = company?.logoPath ? `${API_URL}${company.logoPath}` : null;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getCompaniesApi(),
      getStatsApi(),
      getTendersApi({ limit: 5, sortOrder: 'desc' }),
    ])
      .then(([companyData, statsData, tenderData]) => {
        setCompany(companyData[0] ?? null);
        setStats(statsData);
        setRecentTenders(tenderData);
      })
      .catch((error: unknown) => showError(getErrorMessage(error, 'Şirket bilgileri yüklenemedi')))
      .finally(() => setLoading(false));
  }, []);

  const handleReprovision = async () => {
    if (!company) return;
    setReprovisioning(true);
    try {
      const updated = await reprovisionCompanySchemaApi(company.id);
      setCompany(updated);
      showSuccess(`"${company.name}" için şema yeniden oluşturuldu`);
    } catch (error: unknown) {
      showError(getErrorMessage(error, 'Şema oluşturulamadı'));
    } finally {
      setReprovisioning(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
        <CircularProgress sx={{ color: '#1F2937' }} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center', gap: 1 }}>
          <BusinessIcon sx={{ fontSize: 28, color: '#1F2937' }} />
          Şirket Profili
        </Typography>
      </Box>

      {company ? (
        <>
          <Card
            sx={{
              borderRadius: '8px',
              border: '1px solid #E5E7EB',
              boxShadow: '0 16px 36px rgba(15, 23, 42, 0.08)',
              mb: 3,
            }}
          >
            <CardContent sx={{ p: { xs: 3, md: 4 }, '&:last-child': { pb: { xs: 3, md: 4 } } }}>
              <Box sx={{ display: 'flex', gap: 3, alignItems: { xs: 'flex-start', md: 'center' }, flexDirection: { xs: 'column', md: 'row' } }}>
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: 2,
                    backgroundColor: '#f1f5f9',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: '#1F2937',
                  }}
                >
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={company.name}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                    />
                  ) : (
                    <BadgeIcon sx={{ fontSize: 38 }} />
                  )}
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: { xs: 28, md: 34 }, lineHeight: 1.1, fontWeight: 800, color: '#111827', mb: 1 }}>
                    {company.name}
                  </Typography>
                  <Typography sx={{ color: '#6B7280', fontSize: 14 }}>
                    Oluşturulma: {formatLongDate(company.createdAt)}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                  {company.schemaProvisioned ? (
                    <Chip
                      icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
                      label="Şema Aktif"
                      sx={{
                        backgroundColor: '#DCFCE7',
                        color: '#166534',
                        fontWeight: 700,
                        '& .MuiChip-icon': { color: '#166534' },
                      }}
                    />
                  ) : (
                    <Chip
                      icon={<ErrorIcon sx={{ fontSize: 16 }} />}
                      label="Şema Pasif"
                      sx={{
                        backgroundColor: '#FEE2E2',
                        color: '#991B1B',
                        fontWeight: 700,
                        '& .MuiChip-icon': { color: '#991B1B' },
                      }}
                    />
                  )}
                  <FormButton
                    variant="secondary"
                    size="md"
                    startIcon={<EditIcon sx={{ fontSize: 18 }} />}
                    onClick={() => router.push('/admin/my-company/edit')}
                  >
                    Düzenle
                  </FormButton>
                  <FormButton
                    variant="secondary"
                    size="md"
                    startIcon={<RefreshIcon sx={{ fontSize: 18 }} />}
                    onClick={handleReprovision}
                    loading={reprovisioning}
                  >
                    Şemayı Yenile
                  </FormButton>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(5, 1fr)' }, gap: 2.5, mb: 3 }}>
            <StatCard value={stats?.tenants ?? 0} label="Taşeron" href="/admin/tenants" color="#f59e0b" icon={<ConstructionIcon sx={{ fontSize: 26 }} />} />
            <StatCard value={stats?.materialSupplierCount ?? 0} label="Malzemeci" href="/admin/material-suppliers" color="#7c3aed" icon={<Inventory2Icon sx={{ fontSize: 26 }} />} />
            <StatCard value={stats?.projectCount ?? 0} label="İnşaat" href="/admin/projects" color="#0ea5e9" icon={<ApartmentIcon sx={{ fontSize: 26 }} />} />
            <StatCard value={stats?.tenderCount ?? 0} label="İhale" href="/admin/tenders" color="#10b981" icon={<GavelIcon sx={{ fontSize: 26 }} />} />
            <StatCard value={stats?.users ?? 0} label="Kullanıcı" href="/admin/users" color="#f43f5e" icon={<PeopleIcon sx={{ fontSize: 26 }} />} />
          </Box>

          <Card
            sx={{
              borderRadius: '8px',
              border: '1px solid #E5E7EB',
              boxShadow: '0 10px 26px rgba(15, 23, 42, 0.06)',
            }}
          >
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 3, py: 2.25, gap: 2 }}>
                <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>
                  Son İhaleler
                </Typography>
                <FormButton
                  variant="ghost"
                  size="sm"
                  endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
                  onClick={() => router.push('/admin/tenders')}
                >
                  Tümünü Gör
                </FormButton>
              </Box>
              <Divider />
              {recentTenders.length === 0 ? (
                <Box sx={{ px: 3, py: 4 }}>
                  <Typography sx={{ color: '#6B7280', fontSize: 14 }}>Henüz ihale yok</Typography>
                </Box>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, color: '#374151' }}>Başlık</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#374151' }}>İnşaat</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#374151' }}>Durum</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#374151' }}>Son Tarih</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentTenders.map((tender) => (
                      <TableRow
                        key={tender.id}
                        hover
                        onClick={() => router.push(`/admin/tenders/${tender.id}/edit`)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          <Typography sx={{ fontWeight: 600, color: '#1F2937', fontSize: 14 }}>{tender.title}</Typography>
                        </TableCell>
                        <TableCell sx={{ color: '#6B7280', fontSize: 13 }}>{tender.projectName ?? '—'}</TableCell>
                        <TableCell>
                          <TenderStatusChip status={tender.status} />
                        </TableCell>
                        <TableCell sx={{ color: '#6B7280', fontSize: 13 }}>{formatShortDate(tender.deadline)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card sx={{ borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: 'none' }}>
          <CardContent>
            <Typography sx={{ color: '#6B7280' }}>Şirket bulunamadı</Typography>
          </CardContent>
        </Card>
      )}

      <Notification {...notificationProps} />
    </Box>
  );
}
