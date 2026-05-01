'use client';

import { Box, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { FormButton } from './form-elements/form-button';

interface Props {
  title: string;
  subtitle?: string;
  addLabel?: string;
  addIcon?: React.ReactNode;
  onAdd?: () => void;
  actions?: React.ReactNode;
}

export const PageHeader = ({ title, subtitle, addLabel, addIcon, onAdd, actions }: Props) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
    <Box>
      <Typography variant="h5" fontWeight={700} color="#111827">{title}</Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
      )}
    </Box>
    <Box sx={{ display: 'flex', gap: 1 }}>
      {actions}
      {addLabel && onAdd && (
        <FormButton variant="primary" size="md" startIcon={addIcon ?? <AddIcon />} onClick={onAdd}>
          {addLabel}
        </FormButton>
      )}
    </Box>
  </Box>
);
