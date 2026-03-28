'use client';

import { Checkbox, FormControlLabel, FormControlLabelProps } from '@mui/material';

interface FormCheckboxProps extends Omit<FormControlLabelProps, 'control' | 'label' | 'onChange'> {
  label: string;
  checked?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => void;
  disabled?: boolean;
}

export function FormCheckbox({
  label,
  checked,
  onChange,
  disabled,
  ...rest
}: FormCheckboxProps) {
  return (
    <FormControlLabel
      control={
        <Checkbox
          checked={checked ?? false}
          onChange={onChange}
          disabled={disabled}
          sx={{
            color: '#CBD5E1',
            '&.Mui-checked': { color: '#1F2937' },
            '&.Mui-disabled': { color: '#E5E7EB' },
          }}
        />
      }
      label={label}
      disabled={disabled}
      sx={{
        '& .MuiFormControlLabel-label': {
          fontSize: '14px',
          color: disabled ? '#9CA3AF' : '#1F2937',
          fontWeight: 500,
        },
      }}
      {...rest}
    />
  );
}
