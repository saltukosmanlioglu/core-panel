import { useState } from 'react';

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
}

export const useSnackbar = () => {
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showSuccess = (message: string) =>
    setSnackbar({ open: true, message, severity: 'success' });

  const showError = (message: string) =>
    setSnackbar({ open: true, message, severity: 'error' });

  const notificationProps = {
    open: snackbar.open,
    message: snackbar.message,
    severity: snackbar.severity,
    onClose: () => setSnackbar((s) => ({ ...s, open: false })),
  };

  return { showSuccess, showError, notificationProps };
};
