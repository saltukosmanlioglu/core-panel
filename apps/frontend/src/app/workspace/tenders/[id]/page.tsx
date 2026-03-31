'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Card,
  Typography,
  Chip,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { FormButton } from '@/components/form-elements'
import { Notification } from '@/components'
import { WorkspaceLayout } from '@/components/layout/workspace-layout'
import { getTenderApi } from '@/services/workspace/api'
import { getTenderItemsApi } from '@/services/tender-items/api'
import { getMyOfferApi } from '@/services/tender-offers/api'
import type { Tender, TenderItem, TenderOffer } from '@core-panel/shared'
import { TenderItemUnitLabels } from '@core-panel/shared'

const tenderStatusColors: Record<string, 'default' | 'success' | 'warning' | 'primary'> = {
  draft: 'default',
  open: 'success',
  closed: 'warning',
  awarded: 'primary',
}

const tenderStatusLabels: Record<string, string> = {
  draft: 'Taslak',
  open: 'Açık',
  closed: 'Kapalı',
  awarded: 'Verildi',
}

const offerStatusColors: Record<string, 'default' | 'primary' | 'success' | 'error'> = {
  draft: 'default',
  submitted: 'primary',
  approved: 'success',
  rejected: 'error',
}

const offerStatusLabels: Record<string, string> = {
  draft: 'Taslak',
  submitted: 'Gönderildi',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
}

export default function DashboardTenderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [tender, setTender] = useState<Tender | null>(null)
  const [items, setItems] = useState<TenderItem[]>([])
  const [myOffer, setMyOffer] = useState<TenderOffer | null>(null)
  const [loading, setLoading] = useState(true)

  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({ open: false, message: '', severity: 'success' })

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [tenderRes, itemsRes] = await Promise.all([
          getTenderApi(id),
          getTenderItemsApi(id),
        ])
        setTender(tenderRes)
        setItems(itemsRes)

        try {
          const myOfferRes = await getMyOfferApi(id)
          setMyOffer(myOfferRes)
        } catch {
          // No offer yet — that's fine
          setMyOffer(null)
        }
      } catch {
        setSnackbar({ open: true, message: 'Veriler yüklenemedi.', severity: 'error' })
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [id])

  const colCount = 5

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('tr-TR')
  }

  return (
    <WorkspaceLayout>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <IconButton onClick={() => router.push(tender?.projectId ? `/workspace/projects/${tender.projectId}/tenders` : '/workspace/projects')} size="small">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" fontWeight={700} sx={{ flex: 1 }}>
            {loading ? <Skeleton width={300} /> : tender?.title ?? 'İhale'}
          </Typography>
          {!loading && tender?.status && (
            <Chip
              label={tenderStatusLabels[tender.status] ?? tender.status}
              color={tenderStatusColors[tender.status] ?? 'default'}
            />
          )}
        </Box>

        {/* Tender Info Card */}
        <Card sx={{ p: 3, mb: 3 }}>
          {loading ? (
            <Box>
              <Skeleton variant="text" width="60%" height={32} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="40%" sx={{ mb: 1 }} />
              <Skeleton variant="text" width="80%" />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {tender?.projectName && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
                    Proje:
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {tender.projectName}
                  </Typography>
                </Box>
              )}
              {tender?.description && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
                    Açıklama:
                  </Typography>
                  <Typography variant="body2">{tender.description}</Typography>
                </Box>
              )}
              {tender?.deadline && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
                    Son Başvuru:
                  </Typography>
                  <Typography variant="body2">{formatDate(tender.deadline)}</Typography>
                </Box>
              )}
            </Box>
          )}
        </Card>

        {/* Items Card */}
        <Card sx={{ mb: 3 }}>
          <Box sx={{ p: 2, borderBottom: '1px solid #E5E7EB' }}>
            <Typography variant="h6" fontWeight={700}>
              Kalemler
            </Typography>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#F9FAFB' }}>
                  <TableCell sx={{ fontWeight: 700, width: 60 }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Tanımı</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 70 }}>Birim</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 80 }}>Miktar</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Uygulanacağı Yer</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: colCount }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton variant="text" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={colCount} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        Bu ihaleye ait kalem bulunmuyor.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map(item => (
                    <ReadOnlyItemRow key={item.id} item={item} />
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>

        {/* Bottom Action Bar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 2,
            backgroundColor: '#fff',
            borderRadius: 2,
            border: '1px solid #E5E7EB',
          }}
        >
          {myOffer && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Teklifim:
              </Typography>
              <Chip
                label={offerStatusLabels[myOffer.status] ?? myOffer.status}
                color={offerStatusColors[myOffer.status] ?? 'default'}
                size="small"
              />
            </Box>
          )}
          <Box sx={{ flex: 1 }} />
          <FormButton
            variant="primary"
            size="sm"
            onClick={() => router.push(`/workspace/tenders/${id}/offer`)}
            disabled={loading}
          >
            Fiyat Gir
          </FormButton>
        </Box>
      </Box>

      <Notification
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      />
    </WorkspaceLayout>
  )
}

function ReadOnlyItemRow({ item }: { item: TenderItem }) {
  return (
    <TableRow hover>
      <TableCell sx={{ fontSize: 13 }}>{item.rowNo ?? '—'}</TableCell>
      <TableCell sx={{ fontSize: 13 }}>{item.description}</TableCell>
      <TableCell sx={{ fontSize: 13 }}>{TenderItemUnitLabels[item.unit] ?? item.unit}</TableCell>
      <TableCell sx={{ fontSize: 13 }} align="right">
        {item.quantity != null
          ? parseFloat(String(item.quantity)).toLocaleString('tr-TR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : '—'}
      </TableCell>
      <TableCell sx={{ fontSize: 13 }}>{item.location ?? '—'}</TableCell>
    </TableRow>
  )
}
