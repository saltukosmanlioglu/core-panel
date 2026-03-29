'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import {
  Box,
  Card,
  Typography,
  Chip,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import { FormButton } from '@/components/form-elements'
import { Notification } from '@/components'
import { getTenderApi } from '@/services/workspace/api'
import {
  getOfferComparisonApi,
  approveOfferApi,
  rejectOfferApi,
} from '@/services/tender-offers/api'
import type { Tender, OfferComparison, OfferComparisonItem, OfferComparisonOffer } from '@core-panel/shared'

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

export default function AdminTenderOffersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [tender, setTender] = useState<Tender | null>(null)
  const [comparison, setComparison] = useState<OfferComparison | null>(null)
  const [loading, setLoading] = useState(true)

  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean
    offerId: string
    action: 'approve' | 'reject'
    tenantName: string | null
  } | null>(null)
  const [notesInput, setNotesInput] = useState('')
  const [reviewing, setReviewing] = useState(false)

  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({ open: false, message: '', severity: 'success' })

  const loadData = async () => {
    try {
      setLoading(true)
      const [tenderRes, comparisonRes] = await Promise.all([
        getTenderApi(id),
        getOfferComparisonApi(id),
      ])
      setTender(tenderRes)
      setComparison(comparisonRes)
    } catch {
      setSnackbar({ open: true, message: 'Veriler yüklenemedi.', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  const handleReview = async () => {
    if (!reviewDialog) return
    try {
      setReviewing(true)
      if (reviewDialog.action === 'approve') {
        await approveOfferApi(reviewDialog.offerId, notesInput || undefined)
        setSnackbar({ open: true, message: 'Teklif onaylandı.', severity: 'success' })
      } else {
        await rejectOfferApi(reviewDialog.offerId, notesInput || undefined)
        setSnackbar({ open: true, message: 'Teklif reddedildi.', severity: 'success' })
      }
      setReviewDialog(null)
      setNotesInput('')
      await loadData()
    } catch (err) {
      let message = 'İşlem gerçekleştirilemedi.'
      if (axios.isAxiosError(err)) message = err.response?.data?.message ?? message
      setSnackbar({ open: true, message, severity: 'error' })
    } finally {
      setReviewing(false)
    }
  }

  // Stats
  const offers: OfferComparisonOffer[] = comparison?.offers ?? []
  const totalOffers = offers.length
  const submittedOffers = offers.filter(o => o.status === 'submitted').length
  const approvedOffers = offers.filter(o => o.status === 'approved').length
  const rejectedOffers = offers.filter(o => o.status === 'rejected').length

  // Pre-calculate grand totals per offer
  const grandTotals: Record<string, number> = {}
  offers.forEach(offer => {
    grandTotals[offer.id] = 0
  })
  if (comparison) {
    comparison.items?.forEach(item => {
      offers.forEach(offer => {
        const price = item.prices?.find(p => p.offerId === offer.id)
        if (price) {
          const tutar =
            parseFloat(String(item.quantity ?? 0)) *
            (parseFloat(String(price.materialUnitPrice ?? 0)) +
              parseFloat(String(price.laborUnitPrice ?? 0)))
          grandTotals[offer.id] = (grandTotals[offer.id] ?? 0) + tutar
        }
      })
    })
  }

  // Category subtotals per offer
  const categorySubtotals: Record<string, Record<string, number>> = {}
  if (comparison) {
    comparison.items?.forEach(item => {
      const catId = item.categoryId ?? '__none__'
      if (!categorySubtotals[catId]) {
        categorySubtotals[catId] = {}
        offers.forEach(o => { categorySubtotals[catId][o.id] = 0 })
      }
      offers.forEach(offer => {
        const price = item.prices?.find(p => p.offerId === offer.id)
        if (price) {
          const tutar =
            parseFloat(String(item.quantity ?? 0)) *
            (parseFloat(String(price.materialUnitPrice ?? 0)) +
              parseFloat(String(price.laborUnitPrice ?? 0)))
          categorySubtotals[catId][offer.id] = (categorySubtotals[catId][offer.id] ?? 0) + tutar
        }
      })
    })
  }

  // Group items by category (derive categories from items since OfferComparison has no categories field)
  const allItems = comparison?.items ?? []
  const uncategorizedItems = allItems.filter(item => !item.categoryId)
  const seenCatIds = new Set<string>()
  const categories: { id: string; name: string }[] = []
  allItems.forEach(item => {
    if (item.categoryId && !seenCatIds.has(item.categoryId)) {
      seenCatIds.add(item.categoryId)
      categories.push({ id: item.categoryId, name: item.categoryName ?? item.categoryId })
    }
  })
  const categorizedGroups = categories.map(cat => ({
    category: cat,
    items: allItems.filter(item => item.categoryId === cat.id),
  }))

  const leftColCount = 4
  const rightColsPerOffer = 3

  const fmt = (val: number) =>
    val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const statCards = [
    { label: 'Toplam Teklif', value: totalOffers, color: '#6366F1' },
    { label: 'Gönderildi', value: submittedOffers, color: '#3B82F6' },
    { label: 'Onaylandı', value: approvedOffers, color: '#10B981' },
    { label: 'Reddedildi', value: rejectedOffers, color: '#EF4444' },
  ]

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <IconButton onClick={() => router.push('/admin/tenders')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight={700} sx={{ flex: 1 }}>
          {loading ? <Skeleton width={300} /> : tender?.title ?? 'İhale'}
        </Typography>
        {!loading && tender?.status && (
          <Chip
            label={tenderStatusLabels[tender.status] ?? tender.status}
            color={tenderStatusColors[tender.status] ?? 'default'}
            size="small"
          />
        )}
      </Box>

      {/* Stat Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {statCards.map(card => (
          <Card key={card.label} sx={{ flex: 1, minWidth: 140, p: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {card.label}
            </Typography>
            {loading ? (
              <Skeleton variant="text" width={40} height={40} />
            ) : (
              <Typography variant="h4" fontWeight={700} sx={{ color: card.color }}>
                {card.value}
              </Typography>
            )}
          </Card>
        ))}
      </Box>

      {/* Comparison Table */}
      <Card>
        {loading ? (
          <Box sx={{ p: 3 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="text" height={40} sx={{ mb: 1 }} />
            ))}
          </Box>
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table
              size="small"
              sx={{
                minWidth:
                  leftColCount * 120 + offers.length * rightColsPerOffer * 110,
              }}
            >
              <TableHead>
                {/* Offer name row */}
                <TableRow sx={{ backgroundColor: '#F9FAFB' }}>
                  <TableCell sx={{ fontWeight: 700, width: 50 }}>Sıra No</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Tanımı</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 60 }}>Birim</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 80 }}>Miktar</TableCell>
                  {offers.map(offer => (
                    <TableCell
                      key={offer.id}
                      colSpan={rightColsPerOffer}
                      align="center"
                      sx={{ fontWeight: 700, borderLeft: '2px solid #E5E7EB' }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" fontWeight={700}>
                          {offer.tenantName}
                        </Typography>
                        <Chip
                          label={offerStatusLabels[offer.status] ?? offer.status}
                          color={offerStatusColors[offer.status] ?? 'default'}
                          size="small"
                        />
                        {offer.status === 'submitted' && (
                          <>
                            <Tooltip title="Onayla">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => {
                                  setNotesInput('')
                                  setReviewDialog({
                                    open: true,
                                    offerId: offer.id,
                                    action: 'approve',
                                    tenantName: offer.tenantName,
                                  })
                                }}
                              >
                                <CheckCircleIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reddet">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  setNotesInput('')
                                  setReviewDialog({
                                    open: true,
                                    offerId: offer.id,
                                    action: 'reject',
                                    tenantName: offer.tenantName,
                                  })
                                }}
                              >
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  ))}
                </TableRow>
                {/* Sub-header: Malzeme / İşçilik / Tutar per offer */}
                <TableRow sx={{ backgroundColor: '#F9FAFB' }}>
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  {offers.map(offer => (
                    <>
                      <TableCell
                        key={`${offer.id}-mat`}
                        sx={{ fontSize: 11, color: '#6B7280', borderLeft: '2px solid #E5E7EB' }}
                        align="right"
                      >
                        Malzeme
                      </TableCell>
                      <TableCell
                        key={`${offer.id}-lab`}
                        sx={{ fontSize: 11, color: '#6B7280' }}
                        align="right"
                      >
                        İşçilik
                      </TableCell>
                      <TableCell
                        key={`${offer.id}-tot`}
                        sx={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}
                        align="right"
                      >
                        Tutar
                      </TableCell>
                    </>
                  ))}
                </TableRow>
              </TableHead>

              <TableBody>
                {/* Uncategorized */}
                {uncategorizedItems.length > 0 && (
                  <>
                    <TableRow>
                      <TableCell
                        colSpan={leftColCount + offers.length * rightColsPerOffer}
                        sx={{
                          backgroundColor: '#F3F4F6',
                          fontWeight: 700,
                          color: '#6B7280',
                          fontSize: 13,
                          py: 0.75,
                        }}
                      >
                        Genel
                      </TableCell>
                    </TableRow>
                    {uncategorizedItems.map(item => (
                      <ComparisonItemRow
                        key={item.id}
                        item={item}
                        offers={offers}
                        fmt={fmt}
                      />
                    ))}
                    {/* Subtotal for uncategorized */}
                    {categorySubtotals['__none__'] && (
                      <SubtotalRow
                        label="Ara Toplam"
                        offers={offers}
                        subtotals={categorySubtotals['__none__']}
                        leftColCount={leftColCount}
                        fmt={fmt}
                      />
                    )}
                  </>
                )}

                {/* Categorized */}
                {categorizedGroups.map(({ category, items: catItems }) => (
                  <>
                    <TableRow key={`cat-${category.id}`}>
                      <TableCell
                        colSpan={leftColCount + offers.length * rightColsPerOffer}
                        sx={{
                          backgroundColor: '#F3F4F6',
                          fontWeight: 700,
                          fontSize: 13,
                          py: 0.75,
                        }}
                      >
                        {category.name}
                      </TableCell>
                    </TableRow>
                    {catItems.map(item => (
                      <ComparisonItemRow
                        key={item.id}
                        item={item}
                        offers={offers}
                        fmt={fmt}
                      />
                    ))}
                    {categorySubtotals[category.id] && (
                      <SubtotalRow
                        label="Ara Toplam"
                        offers={offers}
                        subtotals={categorySubtotals[category.id]}
                        leftColCount={leftColCount}
                        fmt={fmt}
                      />
                    )}
                  </>
                ))}

                {/* Grand Total */}
                <TableRow sx={{ backgroundColor: '#1F2937' }}>
                  <TableCell
                    colSpan={leftColCount}
                    sx={{ color: '#fff', fontWeight: 700, fontSize: 14 }}
                  >
                    GENEL TOPLAM
                  </TableCell>
                  {offers.map(offer => (
                    <>
                      <TableCell
                        key={`${offer.id}-gt-mat`}
                        sx={{ borderLeft: '2px solid #374151' }}
                      />
                      <TableCell key={`${offer.id}-gt-lab`} />
                      <TableCell
                        key={`${offer.id}-gt-tot`}
                        align="right"
                        sx={{ color: '#fff', fontWeight: 700, fontSize: 14 }}
                      >
                        {fmt(grandTotals[offer.id] ?? 0)}
                      </TableCell>
                    </>
                  ))}
                </TableRow>

                {allItems.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={leftColCount + offers.length * rightColsPerOffer}
                      align="center"
                      sx={{ py: 4 }}
                    >
                      <Typography color="text.secondary">Henüz kalem bulunmuyor.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      {/* Review Dialog */}
      <Dialog
        open={!!reviewDialog?.open}
        onClose={() => !reviewing && setReviewDialog(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {reviewDialog?.action === 'approve' ? 'Teklifi Onayla' : 'Teklifi Reddet'}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            <strong>{reviewDialog?.tenantName}</strong> firmasının teklifini{' '}
            {reviewDialog?.action === 'approve' ? 'onaylamak' : 'reddetmek'} istediğinize emin
            misiniz?
          </Typography>
          <TextField
            label="Notlar (opsiyonel)"
            multiline
            rows={3}
            fullWidth
            value={notesInput}
            onChange={e => setNotesInput(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <FormButton
            variant="ghost"
            size="sm"
            onClick={() => setReviewDialog(null)}
            disabled={reviewing}
          >
            İptal
          </FormButton>
          <FormButton
            variant={reviewDialog?.action === 'approve' ? 'primary' : 'danger'}
            size="sm"
            onClick={handleReview}
            disabled={reviewing}
            loading={reviewing}
          >
            {reviewDialog?.action === 'approve' ? 'Onayla' : 'Reddet'}
          </FormButton>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Notification
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      />
    </Box>
  )
}

function ComparisonItemRow({
  item,
  offers,
  fmt,
}: {
  item: OfferComparisonItem
  offers: OfferComparisonOffer[]
  fmt: (v: number) => string
}) {
  return (
    <TableRow hover>
      <TableCell sx={{ fontSize: 13 }}>{item.rowNo ?? '—'}</TableCell>
      <TableCell sx={{ fontSize: 13 }}>{item.description}</TableCell>
      <TableCell sx={{ fontSize: 13 }}>{item.unit ?? '—'}</TableCell>
      <TableCell sx={{ fontSize: 13 }} align="right">
        {item.quantity != null
          ? parseFloat(String(item.quantity)).toLocaleString('tr-TR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : '—'}
      </TableCell>
      {offers.map(offer => {
        const price = item.prices?.find(p => p.offerId === offer.id)
        const qty = parseFloat(String(item.quantity ?? 0))
        const mat = parseFloat(String(price?.materialUnitPrice ?? 0))
        const lab = parseFloat(String(price?.laborUnitPrice ?? 0))
        const tutar = qty * (mat + lab)
        return (
          <>
            <TableCell
              key={`${offer.id}-mat`}
              align="right"
              sx={{ fontSize: 13, borderLeft: '2px solid #E5E7EB' }}
            >
              {price ? fmt(mat) : '—'}
            </TableCell>
            <TableCell key={`${offer.id}-lab`} align="right" sx={{ fontSize: 13 }}>
              {price ? fmt(lab) : '—'}
            </TableCell>
            <TableCell
              key={`${offer.id}-tot`}
              align="right"
              sx={{ fontSize: 13, fontWeight: 600 }}
            >
              {price ? fmt(tutar) : '—'}
            </TableCell>
          </>
        )
      })}
    </TableRow>
  )
}

function SubtotalRow({
  label,
  offers,
  subtotals,
  leftColCount,
  fmt,
}: {
  label: string
  offers: OfferComparisonOffer[]
  subtotals: Record<string, number>
  leftColCount: number
  fmt: (v: number) => string
}) {
  return (
    <TableRow sx={{ backgroundColor: '#F9FAFB' }}>
      <TableCell
        colSpan={leftColCount}
        sx={{ fontWeight: 600, fontSize: 13, color: '#374151' }}
      >
        {label}
      </TableCell>
      {offers.map(offer => (
        <>
          <TableCell key={`${offer.id}-sub-mat`} sx={{ borderLeft: '2px solid #E5E7EB' }} />
          <TableCell key={`${offer.id}-sub-lab`} />
          <TableCell
            key={`${offer.id}-sub-tot`}
            align="right"
            sx={{ fontWeight: 700, fontSize: 13 }}
          >
            {fmt(subtotals[offer.id] ?? 0)}
          </TableCell>
        </>
      ))}
    </TableRow>
  )
}
