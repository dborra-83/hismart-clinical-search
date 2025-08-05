import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  Container,
  useTheme
} from '@mui/material';
import { Visibility, VisibilityOff, Person, Lock } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useBranding } from '../contexts/BrandingContext';
import LoadingSpinner from '../components/common/LoadingSpinner';

const LoginPage: React.FC = () => {
  const theme = useTheme();
  const { signIn, loading, error } = useAuth();
  const { branding } = useBranding();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!username.trim()) {
      setLocalError('El nombre de usuario es requerido');
      return;
    }

    if (!password.trim()) {
      setLocalError('La contraseña es requerida');
      return;
    }

    try {
      await signIn(username.trim(), password);
    } catch (err: any) {
      setLocalError(err.message || 'Error de autenticación');
    }
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  if (loading) {
    return <LoadingSpinner message={branding?.textos?.loading || "Iniciando sesión..."} />;
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: branding?.colores?.fondo || theme.palette.background.default,
        backgroundImage: 'linear-gradient(135deg, rgba(13, 71, 161, 0.1) 0%, rgba(25, 118, 210, 0.1) 100%)'
      }}
    >
      <Container maxWidth="sm">
        <Card 
          elevation={8}
          sx={{ 
            borderRadius: 3,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)'
          }}
        >
          <CardContent sx={{ p: 4 }}>
            {/* Logo y título */}
            <Box textAlign="center" mb={4}>
              {branding?.logo && (
                <Box mb={2}>
                  <img 
                    src={branding.logo} 
                    alt={branding.nombre}
                    style={{ 
                      height: 64, 
                      width: 'auto',
                      maxWidth: '100%'
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </Box>
              )}
              
              <Typography 
                variant="h4" 
                gutterBottom
                sx={{ 
                  color: branding?.colores?.primario || theme.palette.primary.main,
                  fontWeight: 600
                }}
              >
                {branding?.nombre || 'HISmart'}
              </Typography>
              
              <Typography 
                variant="body1" 
                color="text.secondary"
                sx={{ mb: 2 }}
              >
                {branding?.textos?.login || 'Bienvenido a HISmart – Plataforma de búsqueda clínica inteligente'}
              </Typography>
            </Box>

            {/* Formulario de login */}
            <Box component="form" onSubmit={handleSubmit}>
              {(error || localError) && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {localError || error}
                </Alert>
              )}

              <TextField
                fullWidth
                label="Usuario"
                variant="outlined"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                margin="normal"
                placeholder="admin o medico1"
                helperText="Usuarios disponibles: admin, medico1"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Person color="action" />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Contraseña"
                type={showPassword ? 'text' : 'password'}
                variant="outlined"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={handleTogglePasswordVisibility}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 3 }}
              />

              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setUsername('admin');
                    setPassword('HISmart2024!');
                  }}
                  sx={{ flex: 1 }}
                >
                  Admin
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setUsername('medico1');
                    setPassword('HISmart2024!');
                  }}
                  sx={{ flex: 1 }}
                >
                  Médico
                </Button>
              </Box>

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                sx={{ 
                  py: 1.5,
                  backgroundColor: branding?.colores?.primario || theme.palette.primary.main,
                  '&:hover': {
                    backgroundColor: branding?.colores?.secundario || theme.palette.primary.dark,
                  }
                }}
              >
                {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>
            </Box>

            {/* Footer */}
            <Box textAlign="center" mt={4}>
              <Typography variant="caption" color="text.secondary">
                {branding?.textos?.footer || '© 2024 HISmart. Todos los derechos reservados.'}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default LoginPage;