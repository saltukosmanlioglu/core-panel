'use client';

import { useEffect, useRef, useState } from 'react';
import { TextField, type TextFieldProps } from '@mui/material';

export const smallTextFieldInputProps = { style: { fontSize: '0.875rem' } };

export const metrajInputSx = {
  '& .MuiInputBase-input': { py: '8px', px: '10px', fontSize: '0.875rem' },
};

function displayValue(value: number): string {
  return value === 0 ? '' : String(value);
}

interface MetrajNumberFieldProps extends Omit<TextFieldProps, 'onChange' | 'value' | 'size' | 'type' | 'inputProps'> {
  value: number;
  onChange: (value: number) => void;
}

export function MetrajNumberField({ value, onChange, sx, ...props }: MetrajNumberFieldProps) {
  const [draft, setDraft] = useState(displayValue(value));
  const lastNumericValue = useRef(value);

  useEffect(() => {
    if (value !== lastNumericValue.current) {
      lastNumericValue.current = value;
      setDraft(displayValue(value));
    }
  }, [value]);

  return (
    <TextField
      {...props}
      size="small"
      value={draft}
      onChange={event => {
        const next = event.target.value;
        setDraft(next);

        if (next.trim() === '') {
          lastNumericValue.current = 0;
          onChange(0);
          return;
        }

        const normalized = next.replace(',', '.');
        const parsed = Number(normalized);
        if (Number.isFinite(parsed)) {
          lastNumericValue.current = parsed;
          onChange(parsed);
        }
      }}
      inputProps={smallTextFieldInputProps}
      sx={{ ...metrajInputSx, ...sx }}
    />
  );
}
