import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useBranding } from '../../contexts/BrandingContext';

interface LoadingSpinnerProps {
  message?: string;
  size?: number;
  fullScreen?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message, 
  size = 40, 
  fullScreen = true 
}) => {
  const { branding } = useBranding();

  const containerProps = fullScreen ? {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    bgcolor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 9999
  } : {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    p: 3
  };

  return (
    <Box sx={containerProps}>
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        gap={2}
      >
        <CircularProgress 
          size={size}
          sx={{ 
            color: branding?.colores?.primario || '#0D47A1'
          }}
        />
        {message && (
          <Typography 
            variant="body2" 
            color="text.secondary"
            textAlign="center"
          >
            {message}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default LoadingSpinner;