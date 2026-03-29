'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import {
  Box, Card, Typography, Skeleton, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Tooltip, CircularProgress,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { FormInput, FormButton, FormSelect } from '@/components/form-elements'
import { ConfirmationDialog, Notification } from '@/components'
import { getTenderApi } from '@/services/workspace/api'
import { getTenderItemsApi, createTenderItemApi, updateTenderItemApi, deleteTenderItemApi } from '@/services/tender-items/api'
import { getTenderCategoriesApi, createTenderCategoryApi, updateTenderCategoryApi, deleteTenderCategoryApi } from '@/services/tender-categories/api'
import type { Tender, TenderItem, TenderCategory } from '@core-panel/shared'

export default function AdminTenderItemsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [tender, setTender] = useState<Tender | null>(null)
  const [categories, setCategories] = useState<TenderCategory[]>([])
  const [items, setItems] = useState<TenderItem[]>([])
  const [loading, setLoading] = useState(true)

  const [itemDialog, setItemDialog] = useState<{ open: boolean; editing: TenderItem | null }>({ open: false, editing: null })
  const [categoryDialog, setCategoryDialog] = useState<{ open: boolean; editing: TenderCategory | null }>({ open: false, editing: null })
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'item' | 'category'; id: string; name: string } | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })

  const [itemCategoryId, setItemCategoryId] = useState('')
  const [itemRowNo, setItemRowNo] = useState('')
  const [itemPosNo, setItemPosNo] = useState('')
  const [itemDescription, setItemDescription] = useState('')
  const [itemUnit, setItemUnit] = useState('')
  const [itemQuantity, setItemQuantity] = useState('')
  const [itemLocation, setItemLocation] = useState('')
  const [itemSaving, setItemSaving] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [categorySaving, setCategorySaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [tenderRes, categoriesRes, itemsRes] = await Promise.all([
        getTenderApi(id),
        getTenderCategoriesApi(id),
        getTenderItemsApi(id),
      ])
      setTender(tenderRes)
      setCategories(categoriesRes)
      setItems(itemsRes)
    } catch {
      setSnackbar({ open: true, message: 'Veriler yüklenemedi.', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const reloadItems = async () => {
    const res = await getTenderItemsApi(id)
    setItems(res)
  }

  const reloadCategoriesAndItems = async () => {
    const [cats, itms] = await Promise.all([getTenderCategoriesApi(id), getTenderItemsApi(id)])
    setCategories(cats)
    setItems(itms)
  }

  useEffect(() => { loadData() }, [id])

  const openAddItem = () => {
    setItemCategoryId(''); setItemRowNo(''); setItemPosNo(''); setItemDescription(''); setItemUnit(''); setItemQuantity(''); setItemLocation('')
    setItemDialog({ open: true, editing: null })
  }

  const openEditItem = (item: TenderItem) => {
    setItemCategoryId(item.categoryId ?? ''); setItemRowNo(String(item.rowNo)); setItemPosNo(item.posNo ?? '')
    setItemDescription(item.description); setItemUnit(item.unit); setItemQuantity(String(item.quantity)); setItemLocation(item.location ?? '')
    setItemDialog({ open: true, editing: item })
  }

  const openAddCategory = () => { setCategoryName(''); setCategoryDialog({ open: true, editing: null }) }
  const openEditCategory = (cat: TenderCategory) => { setCategoryName(cat.name); setCategoryDialog({ open: true, editing: cat }) }

  const handleSaveItem = async () => {
    try {
      setItemSaving(true)
      const payload = {
        categoryId: itemCategoryId || null,
        rowNo: parseInt(itemRowNo) || 1,
        posNo: itemPosNo || undefined,
        description: itemDescription,
        unit: itemUnit,
        quantity: parseFloat(itemQuantity) || 0,
        location: itemLocation || undefined,
      }
      if (itemDialog.editing) {
        await updateTenderItemApi(id, itemDialog.editing.id, payload)
        setSnackbar({ open: true, message: 'Kalem güncellendi.', severity: 'success' })
      } else {
        await createTenderItemApi(id, payload)
        setSnackbar({ open: true, message: 'Kalem eklendi.', severity: 'success' })
      }
      setItemDialog({ open: false, editing: null })
      await reloadItems()
    } catch (err) {
      const message = axios.isAxiosError(err) ? ((err.response?.data as { error?: string })?.error ?? 'Kalem kaydedilemedi.') : 'Kalem kaydedilemedi.'
      setSnackbar({ open: true, message, severity: 'error' })
    } finally {
      setItemSaving(false)
    }
  }

  const handleSaveCategory = async () => {
    try {
      setCategorySaving(true)
      if (categoryDialog.editing) {
        await updateTenderCategoryApi(id, categoryDialog.editing.id, { name: categoryName })
        setSnackbar({ open: true, message: 'Kategori güncellendi.', severity: 'success' })
      } else {
        await createTenderCategoryApi(id, { name: categoryName })
        setSnackbar({ open: true, message: 'Kategori eklendi.', severity: 'success' })
      }
      setCategoryDialog({ open: false, editing: null })
      await reloadCategoriesAndItems()
    } catch (err) {
      const message = axios.isAxiosError(err) ? ((err.response?.data as { error?: string })?.error ?? 'Kategori kaydedilemedi.') : 'Kategori kaydedilemedi.'
      setSnackbar({ open: true, message, severity: 'error' })
    } finally {
      setCategorySaving(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      if (deleteTarget.type === 'item') {
        await deleteTenderItemApi(id, deleteTarget.id)
        setSnackbar({ open: true, message: 'Kalem silindi.', severity: 'success' })
        await reloadItems()
      } else {
        await deleteTenderCategoryApi(id, deleteTarget.id)
        setSnackbar({ open: true, message: 'Kategori silindi.', severity: 'success' })
        await reloadCategoriesAndItems()
      }
      setDeleteTarget(null)
    } catch (err) {
      const message = axios.isAxiosError(err) ? ((err.response?.data as { error?: string })?.error ?? 'Silinemedi.') : 'Silinemedi.'
      setSnackbar({ open: true, message, severity: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  const uncategorizedItems = items.filter(item => !item.categoryId)
  const categorizedItems = categories
    .slice().sort((a, b) => a.orderNo - b.orderNo)
    .map(cat => ({ category: cat, items: items.filter(item => item.categoryId === cat.id) }))

  const categoryOptions = [
    { label: 'Kategorisiz', value: '' },
    ...categories.map(c => ({ label: c.name, value: c.id })),
  ]
  const totalColCount = 7

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <IconButton onClick={() => router.push('/admin/tenders')} size="small"><ArrowBackIcon /></IconButton>
        <Typography variant="h5" fontWeight={700} sx={{ flex: 1 }}>
          {loading ? <Skeleton width={300} /> : (tender?.title ?? 'İhale')} — Kalemler
        </Typography>
        <FormButton variant="secondary" size="sm" startIcon={<AddIcon />} onClick={openAddCategory} disabled={loading}>
          Kategori Ekle
        </FormButton>
        <FormButton variant="primary" size="sm" startIcon={<AddIcon />} onClick={openAddItem} disabled={loading}>
          Kalem Ekle
        </FormButton>
      </Box>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#F9FAFB' }}>
                <TableCell sx={{ fontWeight: 700, width: 60 }}>Sıra No</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 80 }}>Poz No</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Tanımı</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 70 }}>Birim</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 80 }}>Miktar</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Uygulanacağı Yer</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 90 }} align="right">İşlemler</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: totalColCount }).map((__, j) => <TableCell key={j}><Skeleton variant="text" /></TableCell>)}</TableRow>
                ))
              ) : (
                <>
                  {uncategorizedItems.length > 0 && (
                    <>
                      <TableRow>
                        <TableCell colSpan={totalColCount} sx={{ backgroundColor: '#F3F4F6', fontWeight: 700, color: '#6B7280', fontSize: 13, py: 0.75 }}>
                          Genel
                        </TableCell>
                      </TableRow>
                      {uncategorizedItems.map(item => (
                        <ItemRow key={item.id} item={item} onEdit={() => openEditItem(item)} onDelete={() => setDeleteTarget({ type: 'item', id: item.id, name: item.description })} />
                      ))}
                    </>
                  )}
                  {categorizedItems.map(({ category, items: catItems }) => (
                    <Box key={category.id} component="tbody" sx={{ display: 'contents' }}>
                      <TableRow>
                        <TableCell colSpan={totalColCount - 1} sx={{ backgroundColor: '#F3F4F6', fontWeight: 700, fontSize: 13, py: 0.75 }}>
                          {category.name}
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#F3F4F6', py: 0.75 }} align="right">
                          <Tooltip title="Düzenle"><IconButton size="small" onClick={() => openEditCategory(category)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Sil"><IconButton size="small" color="error" onClick={() => setDeleteTarget({ type: 'category', id: category.id, name: category.name })}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                        </TableCell>
                      </TableRow>
                      {catItems.map(item => (
                        <ItemRow key={item.id} item={item} onEdit={() => openEditItem(item)} onDelete={() => setDeleteTarget({ type: 'item', id: item.id, name: item.description })} />
                      ))}
                    </Box>
                  ))}
                  {items.length === 0 && (
                    <TableRow><TableCell colSpan={totalColCount} align="center" sx={{ py: 4 }}><Typography color="text.secondary">Henüz kalem eklenmemiş.</Typography></TableCell></TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Item Dialog */}
      <Dialog open={itemDialog.open} onClose={() => setItemDialog({ open: false, editing: null })} maxWidth="sm" fullWidth>
        <DialogTitle>{itemDialog.editing ? 'Kalemi Düzenle' : 'Kalem Ekle'}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormSelect label="Kategori" value={itemCategoryId} onChange={e => setItemCategoryId(e.target.value as string)} options={categoryOptions} />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormInput label="Sıra No" type="number" value={itemRowNo} onChange={e => setItemRowNo(e.target.value)} fullWidth />
              <FormInput label="Poz No" value={itemPosNo} onChange={e => setItemPosNo(e.target.value)} fullWidth />
            </Box>
            <FormInput label="Tanımı" value={itemDescription} onChange={e => setItemDescription(e.target.value)} multiline rows={2} />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormInput label="Birim" value={itemUnit} onChange={e => setItemUnit(e.target.value)} fullWidth />
              <FormInput label="Miktar" type="number" value={itemQuantity} onChange={e => setItemQuantity(e.target.value)} fullWidth />
            </Box>
            <FormInput label="Uygulanacağı Yer" value={itemLocation} onChange={e => setItemLocation(e.target.value)} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <FormButton variant="ghost" size="sm" onClick={() => setItemDialog({ open: false, editing: null })} disabled={itemSaving}>İptal</FormButton>
          <FormButton variant="primary" size="sm" onClick={handleSaveItem} disabled={itemSaving || !itemDescription || !itemUnit} loading={itemSaving}>Kaydet</FormButton>
        </DialogActions>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={categoryDialog.open} onClose={() => setCategoryDialog({ open: false, editing: null })} maxWidth="xs" fullWidth>
        <DialogTitle>{categoryDialog.editing ? 'Kategoriyi Düzenle' : 'Kategori Ekle'}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ pt: 1 }}>
            <FormInput label="Kategori Adı" value={categoryName} onChange={e => setCategoryName(e.target.value)} autoFocus />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <FormButton variant="ghost" size="sm" onClick={() => setCategoryDialog({ open: false, editing: null })} disabled={categorySaving}>İptal</FormButton>
          <FormButton variant="primary" size="sm" onClick={handleSaveCategory} disabled={categorySaving || !categoryName.trim()} loading={categorySaving}>Kaydet</FormButton>
        </DialogActions>
      </Dialog>

      <ConfirmationDialog
        open={!!deleteTarget}
        title={deleteTarget?.type === 'category' ? 'Kategoriyi Sil' : 'Kalemi Sil'}
        description={deleteTarget ? `"${deleteTarget.name}" ${deleteTarget.type === 'category' ? 'kategorisini' : 'kalemini'} silmek istediğinize emin misiniz?` : ''}
        confirmLabel="Sil"
        confirmVariant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />

      <Notification open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} />
    </Box>
  )
}

function ItemRow({ item, onEdit, onDelete }: { item: TenderItem; onEdit: () => void; onDelete: () => void }) {
  return (
    <TableRow hover>
      <TableCell>{item.rowNo}</TableCell>
      <TableCell>{item.posNo ?? '—'}</TableCell>
      <TableCell>{item.description}</TableCell>
      <TableCell>{item.unit}</TableCell>
      <TableCell>{parseFloat(String(item.quantity)).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
      <TableCell>{item.location ?? '—'}</TableCell>
      <TableCell align="right">
        <Tooltip title="Düzenle"><IconButton size="small" onClick={onEdit}><EditIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Sil"><IconButton size="small" color="error" onClick={onDelete}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
      </TableCell>
    </TableRow>
  )
}
