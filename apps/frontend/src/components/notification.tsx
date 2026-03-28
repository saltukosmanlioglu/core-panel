'use client';

import { Snackbar, Alert, AlertColor } from '@mui/material';

interface NotificationProps {
  open: boolean;
  message: string;
  severity?: AlertColor;
  onClose: () => void;
  autoHideDuration?: number;
}

export function Notification({
  open,
  message,
  severity = 'success',
  onClose,
  autoHideDuration = 4000,
}: NotificationProps) {
  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Alert
        onClose={onClose}
        severity={severity}
        variant="filled"
        sx={{
          minWidth: 300,
          fontWeight: 500,
          fontSize: '13px',
          borderRadius: '4px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
