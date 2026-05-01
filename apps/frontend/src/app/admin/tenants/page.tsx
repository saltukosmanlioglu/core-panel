'use client';

import { useEffect, useState } from 'react';
import { Box, Chip, Typography, Autocomplete, TextField } from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { FormInput } from '@/components/form-elements';
import { ConfirmationDialog, Notification } from '@/components';
import { CrudModal } from '@/components/crud-modal';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { getTenantsApi, deleteTenantApi, createTenantApi, updateTenantApi } from '@/services/admin/api';
import { getCategoriesApi, getTenantCategoriesApi, getTenantCategoriesBatchApi, updateTenantCategoriesApi } from '@/services/categories/api';
import type { Tenant, Category } from '@core-panel/shared';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { useSnackbar } from '@/hooks/useSnackbar';

interface TenantFormData {
  name: string;
  contactName: string;
  contactPhone: string;
  categoryIds: string[];
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tenantCategoryMap, setTenantCategoryMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [formData, setFormData] = useState<TenantFormData>({ name: '', contactName: '', contactPhone: '', categoryIds: [] });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { showSuccess, showError, notificationProps } = useSnackbar();

  const loadTenantCategoryMap = async (tenantList: Tenant[]): Promise<Record<string, string[]>> => {
    if (tenantList.length === 0) return {};
    return getTenantCategoriesBatchApi(tenantList.map((t) => t.id));
  };

  const load = async () => {
    setLoading(true);
    try {
      const [tenantsRes, catsRes] = await Promise.all([getTenantsApi(), getCategoriesApi()]);
      const categoryMap = await loadTenantCategoryMap(tenantsRes);
      setTenants(tenantsRes);
      setCategories(catsRes);
      setTenantCategoryMap(categoryMap);
    } catch (err: unknown) {
      showError(getErrorMessage(err, 'Yüklenemedi'));
    } finally {
      setLoading(false);
    }
  };

  const refreshTenants = async () => {
    setLoading(true);
    try {
      const tenantsRes = await getTenantsApi();
      const categoryMap = await loadTenantCategoryMap(tenantsRes);
      setTenants(tenantsRes);
      setTenantCategoryMap(categoryMap);
    } catch {
      showError('Liste güncellenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const openCreate = () => {
    setEditingTenant(null);
    setFormData({ name: '', contactName: '', contactPhone: '', categoryIds: [] });
    setModalOpen(true);
  };

  const openEdit = async (tenant: Tenant) => {
    setEditingTenant(tenant);
    try {
      const catIds = await getTenantCategoriesApi(tenant.id);
      setFormData({
        name: tenant.name,
        contactName: tenant.contactName ?? '',
        contactPhone: tenant.contactPhone ?? '',
        categoryIds: catIds,
      });
      setModalOpen(true);
    } catch {
      showError('Kategori bilgileri alınamadı');
    }
  };

  const handleClose = () => { if (!saving) setModalOpen(false); };

  const handleSave = async () => {
    if (!formData.name.trim()) return;
    setSaving(true);
    try {
      let tenantId: string;
      const payload = {
        name: formData.name,
        contactName: formData.contactName || undefined,
        contactPhone: formData.contactPhone || undefined,
      };
      if (editingTenant) {
        await updateTenantApi(editingTenant.id, payload);
        tenantId = editingTenant.id;
      } else {
        const res = await createTenantApi(payload);
        tenantId = res.id;
      }
      await updateTenantCategoriesApi(tenantId, formData.categoryIds);
      handleClose();
      void refreshTenants();
      showSuccess(editingTenant ? 'Taşeron güncellendi' : 'Taşeron eklendi');
    } catch (err: any) {
      showError(err?.response?.data?.message ?? 'Bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteTenantApi(deleteId);
      showSuccess('Taşeron silindi');
      setDeleteId(null);
      void refreshTenants();
    } catch {
      showError('Silme işlemi başarısız');
    }
  };

  return (
    <Box>
      <PageHeader title="Taşeronlar" subtitle={`${tenants.length} kayıt`} addLabel="Taşeron Ekle" onAdd={openCreate} />

      <DataTable<Tenant>
        rows={tenants}
        loading={loading}
        getRowId={(row) => row.id}
        columns={[
          {
            field: 'name',
            headerName: 'Ad',
            flex: 1,
            sortable: true,
            renderCell: (row) => (
              <Typography sx={{ fontWeight: 500, color: '#1F2937', fontSize: '14px' }}>{row.name}</Typography>
            ),
          },
          {
            field: 'companyName',
            headerName: 'Şirket',
            flex: 1,
            sortable: true,
            renderCell: (row) => (
              row.companyName
                ? <Chip label={row.companyName} size="small" sx={{ backgroundColor: 'rgba(31,41,55,0.08)', color: '#1F2937', fontWeight: 500, fontSize: '12px' }} />
                : <Typography sx={{ color: '#9CA3AF', fontSize: '13px' }}>—</Typography>
            ),
          },
          {
            field: 'categories',
            headerName: 'Kategoriler',
            flex: 1,
            renderCell: (row) => {
              const tenantCatIds = tenantCategoryMap[row.id] ?? [];
              const visibleCats = categories.filter(c => tenantCatIds.includes(c.id));
              return (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {visibleCats.length === 0 && <Typography variant="caption" color="text.secondary">—</Typography>}
                  {visibleCats.slice(0, 2).map(c => <Chip key={c.id} label={c.name} size="small" variant="outlined" sx={{ fontSize: '11px' }} />)}
                  {visibleCats.length > 2 && <Chip label={`+${visibleCats.length - 2}`} size="small" sx={{ fontSize: '11px' }} />}
                </Box>
              );
            },
          },
          {
            field: 'contactName',
            headerName: 'İlgili Kişi',
            flex: 1,
            sortable: true,
            renderCell: (row) => (
              <Typography sx={{ color: row.contactName ? '#1F2937' : '#9CA3AF', fontSize: '13px' }}>
                {row.contactName || '—'}
              </Typography>
            ),
          },
          {
            field: 'contactPhone',
            headerName: 'Telefon',
            flex: 1,
            sortable: true,
            renderCell: (row) => (
              <Typography sx={{ color: row.contactPhone ? '#1F2937' : '#9CA3AF', fontSize: '13px' }}>
                {row.contactPhone || '—'}
              </Typography>
            ),
          },
          {
            field: 'createdAt',
            headerName: 'Oluşturulma Tarihi',
            width: 160,
            sortable: true,
            renderCell: (row) => (
              <Typography sx={{ color: '#6B7280', fontSize: '13px' }}>
                {new Date(row.createdAt).toLocaleDateString('tr-TR')}
              </Typography>
            ),
          },
        ]}
        actions={[
          {
            label: 'Düzenle',
            icon: <EditIcon fontSize="small" />,
            onClick: (row) => openEdit(row),
            color: 'primary',
          },
          {
            label: 'Sil',
            icon: <DeleteIcon fontSize="small" />,
            onClick: (row) => setDeleteId(row.id),
            color: 'error',
          },
        ]}
        emptyMessage="Henüz taşeron yok"
      />

      <CrudModal
        open={modalOpen}
        title={editingTenant ? 'Taşeron Düzenle' : 'Yeni Taşeron Ekle'}
        saving={saving}
        saveDisabled={!formData.name.trim()}
        onClose={handleClose}
        onSave={handleSave}
      >
        <FormInput label="Taşeron Adı" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
        <FormInput label="İlgili Kişi Adı" value={formData.contactName} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} />
        <FormInput label="Telefon Numarası" type="tel" value={formData.contactPhone} onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })} />
        <Autocomplete
          multiple
          options={categories}
          getOptionLabel={(o) => o.name}
          value={categories.filter((c) => formData.categoryIds.includes(c.id))}
          onChange={(_, v) => setFormData({ ...formData, categoryIds: v.map((c) => c.id) })}
          renderInput={(params) => <TextField {...params} label="Kategoriler" placeholder="Kategori seçin..." />}
          isOptionEqualToValue={(o, v) => o.id === v.id}
        />
      </CrudModal>

      <ConfirmationDialog
        open={!!deleteId}
        title="Taşeron Sil"
        description="Bu taşeronu silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        confirmLabel="Sil"
      />
      <Notification {...notificationProps} />
    </Box>
  );
}
