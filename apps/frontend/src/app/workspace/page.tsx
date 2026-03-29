'use client';

import { Box, Card, Chip, Divider, Typography } from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  Email as EmailIcon,
  Person as PersonIcon,
  VerifiedUser as VerifiedUserIcon,
} from '@mui/icons-material';
import { WorkspaceLayout } from '@/components/layout/workspace-layout';
import { useUser } from '@/contexts/UserContext';

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Box className="flex items-center gap-3 py-3">
      <Box sx={{ color: '#6B7280', display: 'flex', alignItems: 'center' }}>{icon}</Box>
      <Box className="flex-1">
        <Typography
          variant="caption"
          sx={{
            color: '#9CA3AF',
            fontSize: '11px',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {label}
        </Typography>
        <Box sx={{ mt: 0.25 }}>{value}</Box>
      </Box>
    </Box>
  );
}

export default function DashboardPage() {
  const { user } = useUser();

  const lastLoginFormatted = user?.lastLogin
    ? new Date(user.lastLogin).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'İlk giriş';

  return (
    <WorkspaceLayout>
      <Box sx={{ maxWidth: 640 }}>
        <Card sx={{ p: 4, mb: 3 }}>
          <Box className="flex items-start gap-4">
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                backgroundColor: 'rgba(31,41,55,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <PersonIcon sx={{ fontSize: 28, color: '#1F2937' }} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                Hoş geldiniz{user?.name ? `, ${user.name}` : ''}
              </Typography>
              <Typography variant="body2" sx={{ color: '#6B7280' }}>
                Çalışma alanınıza güvenli şekilde giriş yaptınız.
              </Typography>
            </Box>
          </Box>
        </Card>

        <Card sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '15px', mb: 1 }}>
            Hesap Bilgileri
          </Typography>
          <Divider sx={{ mb: 1 }} />

          <DetailRow
            icon={<EmailIcon sx={{ fontSize: 18 }} />}
            label="E-posta Adresi"
            value={
              <Typography variant="body2" sx={{ fontSize: '14px', color: '#1F2937', fontWeight: 500 }}>
                {user?.email}
              </Typography>
            }
          />

          <Divider sx={{ opacity: 0.5 }} />

          <DetailRow
            icon={<VerifiedUserIcon sx={{ fontSize: 18 }} />}
            label="İki Faktörlü Kimlik Doğrulama"
            value={
              <Chip
                label={user?.mfaEnabled ? 'Etkin' : 'Etkin değil'}
                size="small"
                sx={{
                  backgroundColor: user?.mfaEnabled ? '#DCFCE7' : '#FEF3C7',
                  color: user?.mfaEnabled ? '#15803D' : '#92400E',
                  fontWeight: 600,
                  fontSize: '12px',
                  height: 22,
                }}
              />
            }
          />

          <Divider sx={{ opacity: 0.5 }} />

          <DetailRow
            icon={<AccessTimeIcon sx={{ fontSize: 18 }} />}
            label="Son Giriş"
            value={
              <Typography variant="body2" sx={{ fontSize: '14px', color: '#1F2937' }}>
                {lastLoginFormatted}
              </Typography>
            }
          />

          {user?.name && (
            <>
              <Divider sx={{ opacity: 0.5 }} />
              <DetailRow
                icon={<PersonIcon sx={{ fontSize: 18 }} />}
                label="Görünen Ad"
                value={
                  <Typography variant="body2" sx={{ fontSize: '14px', color: '#1F2937' }}>
                    {user.name}
                  </Typography>
                }
              />
            </>
          )}
        </Card>
      </Box>
    </WorkspaceLayout>
  );
}
