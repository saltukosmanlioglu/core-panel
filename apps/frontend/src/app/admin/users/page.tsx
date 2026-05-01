'use client';

import { useEffect, useState } from 'react';
import { Box, Chip, Typography, MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { FormInput } from '@/components/form-elements';
import { ConfirmationDialog, Notification } from '@/components';
import { CrudModal } from '@/components/crud-modal';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { getAdminUsersApi, deleteAdminUserApi, createAdminUserApi, updateAdminUserApi } from '@/services/admin/api';
import { UserRole, type User } from '@core-panel/shared';
import { useSnackbar } from '@/hooks/useSnackbar';

const roleColors: Record<string, { bg: string; color: string }> = {
  company_admin: { bg: '#EDE9FE', color: '#5B21B6' },
  user: { bg: 'rgba(31,41,55,0.08)', color: '#1F2937' },
};

const roleLabels: Record<string, string> = {
  company_admin: 'Şirket Yöneticisi',
  super_admin: 'Süper Admin',
  user: 'Kullanıcı',
};

interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>({ name: '', email: '', password: '', role: UserRole.COMPANY_ADMIN });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { showSuccess, showError, notificationProps } = useSnackbar();

  const load = () => {
    setLoading(true);
    getAdminUsersApi()
      .then(setUsers)
      .catch(() => showError('Yüklenemedi'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingUser(null);
    setFormData({ name: '', email: '', password: '', role: UserRole.COMPANY_ADMIN });
    setModalOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setFormData({ name: user.name || '', email: user.email, password: '', role: user.role });
    setModalOpen(true);
  };

  const handleClose = () => { if (!saving) setModalOpen(false); };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.email.trim()) return;
    if (!editingUser && !formData.password) {
      showError('Şifre zorunludur');
      return;
    }
    setSaving(true);
    try {
      const payload: any = { name: formData.name, email: formData.email, role: formData.role };
      if (formData.password) payload.password = formData.password;

      if (editingUser) {
        await updateAdminUserApi(editingUser.id, payload);
      } else {
        await createAdminUserApi(payload);
      }
      handleClose();
      load();
      showSuccess(editingUser ? 'Kullanıcı güncellendi' : 'Kullanıcı eklendi');
    } catch (err: any) {
      showError(err?.response?.data?.error ?? 'İşlem başarısız');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteAdminUserApi(deleteId);
      showSuccess('Kullanıcı silindi');
      setDeleteId(null);
      load();
    } catch {
      showError('Silinemedi');
    }
  };

  return (
    <Box>
      <PageHeader title="Kullanıcılar" subtitle={`${users.length} kayıt`} addLabel="Kullanıcı Ekle" onAdd={openCreate} />

      <DataTable<User>
        rows={users}
        loading={loading}
        getRowId={(row) => row.id}
        columns={[
          {
            field: 'name',
            headerName: 'Ad',
            flex: 1,
            sortable: true,
            renderCell: (row) => (
              <Box>
                <Typography sx={{ fontWeight: 500, color: '#1F2937', fontSize: '14px' }}>{row.name ?? '—'}</Typography>
                <Typography sx={{ color: '#6B7280', fontSize: '12px' }}>{row.email}</Typography>
              </Box>
            ),
          },
          {
            field: 'role',
            headerName: 'Rol',
            width: 160,
            sortable: true,
            renderCell: (row) => (
              <Chip
                label={roleLabels[row.role] ?? row.role}
                size="small"
                sx={{ ...(roleColors[row.role] ?? roleColors.user), fontWeight: 600, fontSize: '11px' }}
              />
            ),
          },
          {
            field: 'tenantName',
            headerName: 'Taşeron',
            flex: 1,
            sortable: true,
            renderCell: (row) => (
              <Typography sx={{ color: '#6B7280', fontSize: '13px' }}>{row.tenantName ?? '—'}</Typography>
            ),
          },
          {
            field: 'isActive',
            headerName: 'Durum',
            width: 110,
            renderCell: (row) => (
              <Chip
                label={row.isActive ? 'Aktif' : 'Pasif'}
                size="small"
                sx={{
                  backgroundColor: row.isActive ? '#DCFCE7' : '#F3F4F6',
                  color: row.isActive ? '#10B981' : '#6B7280',
                  fontWeight: 600,
                  fontSize: '11px',
                }}
              />
            ),
          },
          {
            field: 'createdAt',
            headerName: 'Oluşturulma Tarihi',
            width: 120,
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
        emptyMessage="Henüz kullanıcı yok"
      />

      <CrudModal
        open={modalOpen}
        title={editingUser ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı Ekle'}
        saving={saving}
        saveDisabled={!formData.name.trim() || !formData.email.trim()}
        onClose={handleClose}
        onSave={handleSave}
      >
        <FormInput label="Ad Soyad" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
        <FormInput label="E-posta" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
        <FormInput
          label={editingUser ? 'Şifre (Değiştirmek için girin)' : 'Şifre'}
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required={!editingUser}
        />
        <FormControl fullWidth>
          <InputLabel>Rol</InputLabel>
          <Select value={formData.role} label="Rol" onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
            <MenuItem value={UserRole.COMPANY_ADMIN}>Şirket Yöneticisi</MenuItem>
          </Select>
        </FormControl>
      </CrudModal>

      <ConfirmationDialog
        open={!!deleteId}
        title="Kullanıcı Sil"
        description="Bu kullanıcıyı silmek istediğinize emin misiniz?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        confirmLabel="Sil"
      />
      <Notification {...notificationProps} />
    </Box>
  );
}
