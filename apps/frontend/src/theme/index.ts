'use client';

import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#1F2937',
      light: '#374151',
      dark: '#111827',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#3B82F6',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F9FAFB',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#111827',
      secondary: '#6B7280',
    },
    error: {
      main: '#EF4444',
    },
    success: {
      main: '#10B981',
    },
    warning: {
      main: '#F59E0B',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
    h1: { fontWeight: 700, color: '#111827' },
    h2: { fontWeight: 700, color: '#111827' },
    h3: { fontWeight: 700, color: '#111827' },
    h4: { fontWeight: 600, color: '#111827' },
    h5: { fontWeight: 600, color: '#111827' },
    h6: { fontWeight: 600, color: '#111827' },
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          textTransform: 'none',
          fontWeight: 600,
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        fullWidth: true,
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 4,
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#3B82F6',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#3B82F6',
              borderWidth: 2,
            },
          },
          '& .MuiInputLabel-root.Mui-focused': {
            color: '#374151',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 4,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          borderRadius: 0,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { background-color: #F8F9FA; }
      `,
    },
  },
});
