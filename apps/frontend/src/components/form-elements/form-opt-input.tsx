'use client';

import { useRef, KeyboardEvent, ClipboardEvent } from 'react';
import { Box, TextField, Typography } from '@mui/material';

interface FormOptInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  errorMessage?: string;
  length?: number;
}

export function FormOptInput({
  value,
  onChange,
  disabled = false,
  error = false,
  errorMessage,
  length = 6,
}: FormOptInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = value.padEnd(length, '').split('').slice(0, length);

  const handleChange = (index: number, char: string) => {
    const sanitized = char.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = sanitized;
    const newValue = newDigits.join('').replace(/\s/g, '');
    onChange(newValue);

    if (sanitized && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const newDigits = [...digits];
        newDigits[index] = '';
        onChange(newDigits.join('').trimEnd());
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        onChange(newDigits.join('').trimEnd());
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    onChange(pasted);
    const focusIndex = Math.min(pasted.length, length - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  return (
    <Box>
      <Box className="flex gap-3 justify-center">
        {Array.from({ length }).map((_, i) => (
          <TextField
            key={i}
            inputRef={(el) => { inputRefs.current[i] = el; }}
            value={digits[i] === ' ' || !digits[i] ? '' : digits[i]}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            disabled={disabled}
            inputProps={{
              maxLength: 1,
              style: {
                textAlign: 'center',
                fontSize: '20px',
                fontWeight: 600,
                padding: '12px 0',
                color: '#1F2937',
              },
              'aria-label': `Digit ${i + 1}`,
            }}
            sx={{
              width: 48,
              '& .MuiOutlinedInput-root': {
                borderRadius: '4px',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: error ? '#EF4444' : digits[i] ? '#3B82F6' : '#E5E7EB',
                  borderWidth: digits[i] ? 2 : 1,
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: error ? '#EF4444' : '#3B82F6',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: error ? '#EF4444' : '#3B82F6',
                  borderWidth: 2,
                },
                backgroundColor: digits[i] ? 'rgba(31,41,55,0.03)' : '#FFFFFF',
              },
            }}
          />
        ))}
      </Box>
      {error && errorMessage && (
        <Typography
          variant="caption"
          sx={{ color: '#EF4444', mt: 1, display: 'block', textAlign: 'center' }}
        >
          {errorMessage}
        </Typography>
      )}
    </Box>
  );
}
