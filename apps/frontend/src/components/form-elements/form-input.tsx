'use client';

import { useState } from 'react';
import {
  TextField,
  TextFieldProps,
  InputAdornment,
  IconButton,
  FormControl,
  FormLabel,
  FormHelperText,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';

interface FormInputProps extends Omit<TextFieldProps, 'variant' | 'label'> {
  label: string;
  error?: boolean;
  errorMessage?: string;
  startIcon?: React.ReactNode;
  password?: boolean;
}

export function FormInput({
  label,
  error,
  errorMessage,
  startIcon,
  password,
  type,
  id,
  disabled,
  sx,
  ...rest
}: FormInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  const inputType = password ? (showPassword ? 'text' : 'password') : (type ?? 'text');
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');

  return (
    <FormControl fullWidth error={error} disabled={disabled}>
      <FormLabel
        htmlFor={inputId}
        sx={{
          fontSize: '13px',
          fontWeight: 500,
          color: error ? '#EF4444' : '#374151',
          mb: 0.5,
          '&.Mui-focused': { color: error ? '#EF4444' : '#374151' },
        }}
      >
        {label}
      </FormLabel>
      <TextField
        id={inputId}
        type={inputType}
        error={error}
        disabled={disabled}
        variant="outlined"
        size="small"
        InputProps={{
          startAdornment: startIcon ? (
            <InputAdornment position="start">{startIcon}</InputAdornment>
          ) : undefined,
          endAdornment: password ? (
            <InputAdornment position="end">
              <IconButton
                onClick={() => setShowPassword((prev) => !prev)}
                edge="end"
                size="small"
                disabled={disabled}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <VisibilityOff sx={{ fontSize: 18, color: '#64748B' }} />
                ) : (
                  <Visibility sx={{ fontSize: 18, color: '#64748B' }} />
                )}
              </IconButton>
            </InputAdornment>
          ) : undefined,
          sx: {
            borderRadius: '4px',
            backgroundColor: '#FFFFFF',
            fontSize: '14px',
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: error ? '#EF4444' : '#3B82F6',
              borderWidth: 2,
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: error ? '#EF4444' : '#3B82F6',
            },
          },
        }}
        sx={{ mb: 0, ...sx }}
        {...rest}
      />
      {error && errorMessage && (
        <FormHelperText sx={{ fontSize: '12px', mt: 0.5, mx: 0 }}>
          {errorMessage}
        </FormHelperText>
      )}
    </FormControl>
  );
}
