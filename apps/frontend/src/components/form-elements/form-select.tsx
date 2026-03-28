'use client';

import {
  FormControl,
  FormLabel,
  Select,
  MenuItem,
  FormHelperText,
  SelectProps,
} from '@mui/material';

export interface FormSelectOption {
  label: string;
  value: string;
}

interface FormSelectProps extends Omit<SelectProps, 'label'> {
  label: string;
  options: FormSelectOption[];
  error?: boolean;
  errorMessage?: string;
  placeholder?: string;
}

export function FormSelect({
  label,
  options,
  error,
  errorMessage,
  placeholder,
  id,
  disabled,
  value,
  onChange,
  sx,
  ...rest
}: FormSelectProps) {
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
      <Select
        id={inputId}
        value={value ?? ''}
        onChange={onChange}
        disabled={disabled}
        error={error}
        size="small"
        displayEmpty
        sx={{
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
          ...sx,
        }}
        {...rest}
      >
        {placeholder && (
          <MenuItem value="" disabled>
            <span style={{ color: '#9CA3AF' }}>{placeholder}</span>
          </MenuItem>
        )}
        {options.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </Select>
      {error && errorMessage && (
        <FormHelperText sx={{ fontSize: '12px', mt: 0.5, mx: 0 }}>
          {errorMessage}
        </FormHelperText>
      )}
    </FormControl>
  );
}
