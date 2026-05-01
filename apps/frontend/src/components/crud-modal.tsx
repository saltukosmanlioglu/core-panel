'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Button,
  CircularProgress,
} from '@mui/material';

interface Props {
  open: boolean;
  title: string;
  saving: boolean;
  saveDisabled?: boolean;
  onClose: () => void;
  onSave: () => void;
  children: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg';
}

export const CrudModal = ({
  open,
  title,
  saving,
  saveDisabled = false,
  onClose,
  onSave,
  children,
  maxWidth = 'sm',
}: Props) => (
  <Dialog open={open} onClose={onClose} maxWidth={maxWidth} fullWidth disableEscapeKeyDown={saving}>
    <DialogTitle sx={{ fontWeight: 700, fontSize: 18 }}>{title}</DialogTitle>
    <Divider />
    <DialogContent sx={{ pt: 3, pb: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {children}
    </DialogContent>
    <Divider />
    <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
      <Button variant="outlined" onClick={onClose} disabled={saving}>İptal</Button>
      <Button
        variant="contained"
        onClick={onSave}
        disabled={saving || saveDisabled}
        startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
      >
        {saving ? 'Kaydediliyor...' : 'Kaydet'}
      </Button>
    </DialogActions>
  </Dialog>
);
