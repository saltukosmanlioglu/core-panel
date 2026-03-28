'use client';

import { Button, ButtonProps, CircularProgress } from '@mui/material';

type FormButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type FormButtonSize = 'sm' | 'md' | 'lg';

interface FormButtonProps extends Omit<ButtonProps, 'variant' | 'size'> {
  variant?: FormButtonVariant;
  size?: FormButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

const muiVariantMap: Record<FormButtonVariant, ButtonProps['variant']> = {
  primary: 'contained',
  secondary: 'outlined',
  ghost: 'text',
  danger: 'contained',
};

const muiSizeMap: Record<FormButtonSize, ButtonProps['size']> = {
  sm: 'small',
  md: 'medium',
  lg: 'large',
};

const sizeStyles: Record<FormButtonSize, object> = {
  sm: { padding: '6px 16px', fontSize: '13px', minHeight: 32 },
  md: { padding: '8px 20px', fontSize: '14px', minHeight: 38 },
  lg: { padding: '12px 24px', fontSize: '15px', minHeight: 48 },
};

export function FormButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  children,
  sx,
  ...rest
}: FormButtonProps) {
  const isSecondary = variant === 'secondary';
  const isGhost = variant === 'ghost';
  const isDanger = variant === 'danger';

  return (
    <Button
      variant={muiVariantMap[variant]}
      size={muiSizeMap[size]}
      fullWidth={fullWidth}
      disabled={disabled ?? loading}
      sx={{
        ...sizeStyles[size],
        borderRadius: '4px',
        fontWeight: 600,
        textTransform: 'none',
        boxShadow: 'none',
        ...(variant === 'primary' && {
          backgroundColor: '#1F2937',
          color: '#FFFFFF',
          '&:hover': { backgroundColor: '#111827', boxShadow: 'none' },
          '&:disabled': { backgroundColor: '#CBD5E1', color: '#9CA3AF' },
        }),
        ...(isSecondary && {
          borderColor: '#1F2937',
          color: '#1F2937',
          '&:hover': { backgroundColor: '#F9FAFB', borderColor: '#111827' },
        }),
        ...(isGhost && {
          color: '#1F2937',
          '&:hover': { backgroundColor: '#F9FAFB' },
        }),
        ...(isDanger && {
          backgroundColor: '#EF4444',
          color: '#FFFFFF',
          '&:hover': { backgroundColor: '#DC2626', boxShadow: 'none' },
          '&:disabled': { backgroundColor: '#CBD5E1', color: '#9CA3AF' },
        }),
        ...sx,
      }}
      {...rest}
    >
      {loading ? (
        <CircularProgress
          size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16}
          sx={{ color: variant === 'primary' || variant === 'danger' ? '#FFFFFF' : '#1F2937' }}
        />
      ) : (
        children
      )}
    </Button>
  );
}
