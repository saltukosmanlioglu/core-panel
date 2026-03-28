'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Box,
} from '@mui/material';
import { FormButton } from './form-elements/form-button';

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger';
}

export function ConfirmationDialog({
  open,
  title,
  description,
  onConfirm,
  onCancel,
  loading = false,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
}: ConfirmationDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onCancel}
      PaperProps={{
        sx: { borderRadius: '4px', minWidth: 360, p: 1 },
      }}
    >
      <DialogTitle sx={{ fontWeight: 700, fontSize: '17px', color: '#111827', pb: 0.5 }}>
        {title}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: '14px', color: '#6B7280' }}>
          {description}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Box className="flex gap-2 justify-end w-full">
          <FormButton variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </FormButton>
          <FormButton variant={confirmVariant} size="sm" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </FormButton>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
