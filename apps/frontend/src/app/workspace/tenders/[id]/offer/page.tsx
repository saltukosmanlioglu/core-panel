'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
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
  TextField,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import SendIcon from '@mui/icons-material/Send'
import { FormButton } from '@/components/form-elements'
import { ConfirmationDialog, Notification } from '@/components'
import { WorkspaceLayout } from '@/components/layout/workspace-layout'
import { getTenderApi } from '@/services/workspace/api'
import { getTenderItemsApi } from '@/services/tender-items/api'
import {
  upsertOfferApi,
  getOfferItemsApi,
  bulkUpdateOfferItemsApi,
  submitOfferApi,
} from '@/services/tender-offers/api'
import type { Tender, TenderItem, TenderOffer } from '@core-panel/shared'
import { TenderItemUnitLabels } from '@core-panel/shared'

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

type PriceEntry = {
  materialUnitPrice: string
  laborUnitPrice: string
}

export default function DashboardTenderOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [tender, setTender] = useState<Tender | null>(null)
  const [items, setItems] = useState<TenderItem[]>([])
  const [offer, setOffer] = useState<TenderOffer | null>(null)
  const [loading, setLoading] = useState(true)

  const [prices, setPrices] = useState<Record<string, PriceEntry>>({})
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false)

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
        const loadedItems: TenderItem[] = itemsRes
        setItems(loadedItems)

        // Upsert offer (creates draft if none, returns existing otherwise)
        const currentOffer: TenderOffer = await upsertOfferApi(id)
        setOffer(currentOffer)

        // Load existing offer items to pre-populate prices
        const initPrices: Record<string, PriceEntry> = {}
        loadedItems.forEach(item => {
          initPrices[item.id] = { materialUnitPrice: '0', laborUnitPrice: '0' }
        })

        if (currentOffer?.id) {
          try {
            const offerItems = await getOfferItemsApi(currentOffer.id)
            offerItems.forEach((oi: any) => {
              if (initPrices[oi.itemId] !== undefined) {
                initPrices[oi.itemId] = {
                  materialUnitPrice: String(oi.materialUnitPrice ?? '0'),
                  laborUnitPrice: String(oi.laborUnitPrice ?? '0'),
                }
              }
            })
          } catch {
            // Could not load offer items — leave zeros
          }
        }

        setPrices(initPrices)
      } catch {
        setSnackbar({ open: true, message: 'Veriler yüklenemedi.', severity: 'error' })
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [id])

  const isReadOnly =
    offer?.status === 'submitted' ||
    offer?.status === 'approved' ||
    offer?.status === 'rejected'

  const calcTutar = useCallback(
    (itemId: string, quantity: string | number | null | undefined) => {
      const qty = parseFloat(String(quantity ?? 0)) || 0
      const mat = parseFloat(prices[itemId]?.materialUnitPrice || '0') || 0
      const lab = parseFloat(prices[itemId]?.laborUnitPrice || '0') || 0
      return qty * (mat + lab)
    },
    [prices]
  )

  const calcGrandTotal = useCallback(() => {
    return items.reduce((sum, item) => sum + calcTutar(item.id, item.quantity), 0)
  }, [items, calcTutar])

  const fmt = (val: number) =>
    val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const buildBulkPayload = () =>
    items.map(item => ({
      itemId: item.id,
      materialUnitPrice: parseFloat(prices[item.id]?.materialUnitPrice || '0') || 0,
      laborUnitPrice: parseFloat(prices[item.id]?.laborUnitPrice || '0') || 0,
    }))

  const handleSaveDraft = async () => {
    if (!offer) return
    try {
      setSaving(true)
      await bulkUpdateOfferItemsApi(offer.id, buildBulkPayload())
      setSnackbar({ open: true, message: 'Taslak kaydedildi.', severity: 'success' })
    } catch (err) {
      let message = 'Kaydetme başarısız.'
      if (axios.isAxiosError(err)) message = err.response?.data?.message ?? message
      setSnackbar({ open: true, message, severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!offer) return
    try {
      setSubmitting(true)
      await bulkUpdateOfferItemsApi(offer.id, buildBulkPayload())
      await submitOfferApi(offer.id)
      setOffer(prev => (prev ? { ...prev, status: 'submitted' } : prev))
      setSnackbar({ open: true, message: 'Teklifiniz gönderildi.', severity: 'success' })
      setConfirmSubmitOpen(false)
    } catch (err) {
      let message = 'Teklif gönderilemedi.'
      if (axios.isAxiosError(err)) message = err.response?.data?.message ?? message
      setSnackbar({ open: true, message, severity: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  // # | Tanımı | Birim | Miktar | Malzeme B.F. | İşçilik B.F. | Tutar
  const totalColCount = 7

  return (
    <WorkspaceLayout>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <IconButton onClick={() => router.push(`/workspace/tenders/${id}`)} size="small">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" fontWeight={700} sx={{ flex: 1 }}>
            {loading ? <Skeleton width={300} /> : tender?.title ?? 'İhale'}
          </Typography>
          {!loading && offer?.status && (
            <Chip
              label={offerStatusLabels[offer.status] ?? offer.status}
              color={offerStatusColors[offer.status] ?? 'default'}
            />
          )}
        </Box>

        {/* BOQ Table */}
        <Card sx={{ mb: 3 }}>
          {loading ? (
            <Box sx={{ p: 3 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} variant="text" height={44} sx={{ mb: 1 }} />
              ))}
            </Box>
          ) : (
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 900 }}>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#F9FAFB' }}>
                    <TableCell sx={{ fontWeight: 700, width: 55 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Tanımı</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 80 }}>Birim</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 80 }} align="right">
                      Miktar
                    </TableCell>
                    <TableCell
                      sx={{ fontWeight: 700, width: 130, borderLeft: '2px solid #E5E7EB' }}
                      align="right"
                    >
                      Malzeme Birim Fiyat
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 130 }} align="right">
                      İşçilik Birim Fiyat
                    </TableCell>
                    <TableCell
                      sx={{ fontWeight: 700, width: 120, borderLeft: '2px solid #E5E7EB' }}
                      align="right"
                    >
                      Tutar
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map(item => (
                    <PriceInputRow
                      key={item.id}
                      item={item}
                      prices={prices}
                      setPrices={setPrices}
                      isReadOnly={isReadOnly}
                      calcTutar={calcTutar}
                      fmt={fmt}
                    />
                  ))}

                  {/* Grand Total */}
                  <TableRow sx={{ backgroundColor: '#1F2937' }}>
                    <TableCell
                      colSpan={totalColCount - 1}
                      sx={{ color: '#fff', fontWeight: 700, fontSize: 14 }}
                    >
                      GENEL TOPLAM
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ color: '#fff', fontWeight: 700, fontSize: 15 }}
                    >
                      {fmt(calcGrandTotal())}
                    </TableCell>
                  </TableRow>

                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={totalColCount} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">
                          Bu ihaleye ait kalem bulunmuyor.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Card>

        {/* Bottom Action Bar */}
        {!loading && !isReadOnly && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 2,
              p: 2,
              backgroundColor: '#fff',
              borderRadius: 2,
              border: '1px solid #E5E7EB',
            }}
          >
            <FormButton
              variant="secondary"
              size="sm"
              startIcon={<SaveIcon />}
              onClick={handleSaveDraft}
              disabled={saving || submitting}
              loading={saving}
            >
              Taslak Kaydet
            </FormButton>
            <FormButton
              variant="primary"
              size="sm"
              startIcon={<SendIcon />}
              onClick={() => setConfirmSubmitOpen(true)}
              disabled={saving || submitting}
            >
              Teklif Ver
            </FormButton>
          </Box>
        )}

        {/* Submit Confirmation */}
        <ConfirmationDialog
          open={confirmSubmitOpen}
          title="Teklifi Gönder"
          description="Teklifinizi göndermek istediğinize emin misiniz? Gönderdikten sonra fiyatlarınızı düzenleyemezsiniz."
          confirmLabel="Gönder"
          confirmVariant="primary"
          onConfirm={handleSubmit}
          onCancel={() => setConfirmSubmitOpen(false)}
          loading={submitting}
        />

        {/* Snackbar */}
        <Notification
          open={snackbar.open}
          message={snackbar.message}
          severity={snackbar.severity}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        />
      </Box>
    </WorkspaceLayout>
  )
}

function PriceInputRow({
  item,
  prices,
  setPrices,
  isReadOnly,
  calcTutar,
  fmt,
}: {
  item: TenderItem
  prices: Record<string, PriceEntry>
  setPrices: React.Dispatch<React.SetStateAction<Record<string, PriceEntry>>>
  isReadOnly: boolean
  calcTutar: (itemId: string, quantity: any) => number
  fmt: (v: number) => string
}) {
  const tutar = calcTutar(item.id, item.quantity)

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

      {/* Malzeme Birim Fiyat */}
      <TableCell sx={{ borderLeft: '2px solid #E5E7EB', py: 0.5 }}>
        <TextField
          size="small"
          type="number"
          inputProps={{
            min: 0,
            step: '0.01',
            style: { textAlign: 'right', padding: '4px 8px', fontSize: '13px' },
          }}
          value={prices[item.id]?.materialUnitPrice ?? '0'}
          onChange={e =>
            setPrices(prev => ({
              ...prev,
              [item.id]: {
                ...prev[item.id],
                materialUnitPrice: e.target.value,
              },
            }))
          }
          disabled={isReadOnly}
          sx={{ width: 110 }}
        />
      </TableCell>

      {/* İşçilik Birim Fiyat */}
      <TableCell sx={{ py: 0.5 }}>
        <TextField
          size="small"
          type="number"
          inputProps={{
            min: 0,
            step: '0.01',
            style: { textAlign: 'right', padding: '4px 8px', fontSize: '13px' },
          }}
          value={prices[item.id]?.laborUnitPrice ?? '0'}
          onChange={e =>
            setPrices(prev => ({
              ...prev,
              [item.id]: {
                ...prev[item.id],
                laborUnitPrice: e.target.value,
              },
            }))
          }
          disabled={isReadOnly}
          sx={{ width: 110 }}
        />
      </TableCell>

      {/* Tutar (calculated: qty × (mat + lab)) */}
      <TableCell
        align="right"
        sx={{ fontSize: 13, fontWeight: 700, borderLeft: '2px solid #E5E7EB' }}
      >
        {fmt(tutar)}
      </TableCell>
    </TableRow>
  )
}
