import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  Tabs,
  Tab,
  Avatar,
  Badge,
  IconButton,
  Paper
} from '@mui/material';
import {
  Settings,
  Person,
  Security,
  Palette,
  Notifications,
  PhotoCamera,
  Save,
  Refresh
} from '@mui/icons-material';

import { useAuth } from '../contexts/AuthContext';
import { useBranding } from '../contexts/BrandingContext';

interface SettingsTabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const SettingsTabPanel: React.FC<SettingsTabPanelProps> = ({ children, value, index }) => {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
};

const SettingsPage: React.FC = () => {
  const { user, updateUserAttributes } = useAuth();
  const { branding, updateBranding } = useBranding();
  
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Estado para perfil de usuario
  const [userProfile, setUserProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    especialidad: user?.especialidad || '',
    hospital: user?.hospital || '',
    telefono: ''
  });

  // Estado para configuración de branding
  const [brandingConfig, setBrandingConfig] = useState({
    nombre: branding?.nombre || 'HISmart',
    colorPrimario: branding?.colores?.primario || '#0D47A1',
    colorSecundario: branding?.colores?.secundario || '#1976D2',
    colorFondo: branding?.colores?.fondo || '#F4F6F8'
  });

  // Estado para notificaciones
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    pushNotifications: false,
    reportes: true,
    alertas: true
  });

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    setMessage(null);

    try {
      await updateUserAttributes({
        name: userProfile.name,
        'custom:especialidad': userProfile.especialidad,
        'custom:hospital': userProfile.hospital
      });

      setMessage({ type: 'success', text: 'Perfil actualizado exitosamente' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Error actualizando perfil' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBranding = () => {
    updateBranding({
      nombre: brandingConfig.nombre,
      colores: {
        ...branding?.colores,
        primario: brandingConfig.colorPrimario,
        secundario: brandingConfig.colorSecundario,
        fondo: brandingConfig.colorFondo,
        texto: branding?.colores?.texto || '#333333',
        exito: branding?.colores?.exito || '#4CAF50',
        error: branding?.colores?.error || '#F44336',
        advertencia: branding?.colores?.advertencia || '#FF9800',
        info: branding?.colores?.info || '#2196F3'
      }
    });
    
    setMessage({ type: 'success', text: 'Configuración de marca actualizada' });
  };

  const handleResetBranding = () => {
    setBrandingConfig({
      nombre: 'HISmart',
      colorPrimario: '#0D47A1',
      colorSecundario: '#1976D2',
      colorFondo: '#F4F6F8'
    });
  };

  return (
    <Box>
      {/* Header */}
      <Box mb={4}>
        <Typography variant="h4" gutterBottom sx={{ color: branding?.colores?.primario }}>
          Configuración
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Personaliza tu perfil y la configuración del sistema
        </Typography>
      </Box>

      {message && (
        <Alert 
          severity={message.type} 
          sx={{ mb: 3 }}
          onClose={() => setMessage(null)}
        >
          {message.text}
        </Alert>
      )}

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab label="Perfil" icon={<Person />} />
            <Tab label="Seguridad" icon={<Security />} />
            <Tab label="Branding" icon={<Palette />} />
            <Tab label="Notificaciones" icon={<Notifications />} />
          </Tabs>
        </Box>

        {/* Panel de Perfil */}
        <SettingsTabPanel value={activeTab} index={0}>
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                  <Badge
                    overlap="circular"
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    badgeContent={
                      <IconButton size="small" sx={{ bgcolor: 'primary.main', color: 'white' }}>
                        <PhotoCamera fontSize="small" />
                      </IconButton>
                    }
                  >
                    <Avatar sx={{ width: 120, height: 120, fontSize: '3rem' }}>
                      {user?.name?.charAt(0) || user?.username?.charAt(0) || 'U'}
                    </Avatar>
                  </Badge>
                  <Typography variant="h6">
                    {user?.name || user?.username}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user?.email}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} md={8}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Nombre completo"
                      value={userProfile.name}
                      onChange={(e) => setUserProfile({ ...userProfile, name: e.target.value })}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Email"
                      value={userProfile.email}
                      disabled
                      helperText="El email no se puede modificar"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Especialidad"
                      value={userProfile.especialidad}
                      onChange={(e) => setUserProfile({ ...userProfile, especialidad: e.target.value })}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Hospital/Institución"
                      value={userProfile.hospital}
                      onChange={(e) => setUserProfile({ ...userProfile, hospital: e.target.value })}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Teléfono"
                      value={userProfile.telefono}
                      onChange={(e) => setUserProfile({ ...userProfile, telefono: e.target.value })}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Usuario"
                      value={user?.username}
                      disabled
                      helperText="El nombre de usuario no se puede modificar"
                    />
                  </Grid>
                </Grid>

                <Box mt={3}>
                  <Button
                    variant="contained"
                    onClick={handleSaveProfile}
                    disabled={loading}
                    startIcon={<Save />}
                  >
                    {loading ? 'Guardando...' : 'Guardar Cambios'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </SettingsTabPanel>

        {/* Panel de Seguridad */}
        <SettingsTabPanel value={activeTab} index={1}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Seguridad de la Cuenta
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Autenticación Multifactor (MFA)
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    MFA está habilitado para tu cuenta. Esto proporciona una capa adicional de seguridad.
                  </Typography>
                  <Button variant="outlined" disabled>
                    MFA Configurado
                  </Button>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Última Actividad
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Último acceso: {new Date().toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Dispositivo: Navegador Web
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    IP: 192.168.1.100
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Permisos y Roles
                </Typography>
                <Box display="flex" flexWrap="wrap" gap={1}>
                  {user?.groups.map((group) => (
                    <Paper key={group} sx={{ px: 2, py: 1, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                      <Typography variant="body2">{group}</Typography>
                    </Paper>
                  ))}
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </SettingsTabPanel>

        {/* Panel de Branding */}
        <SettingsTabPanel value={activeTab} index={2}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Personalización de Marca
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Personaliza la apariencia de la aplicación según tu institución
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Nombre de la aplicación"
                  value={brandingConfig.nombre}
                  onChange={(e) => setBrandingConfig({ ...brandingConfig, nombre: e.target.value })}
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  label="Color Primario"
                  type="color"
                  value={brandingConfig.colorPrimario}
                  onChange={(e) => setBrandingConfig({ ...brandingConfig, colorPrimario: e.target.value })}
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  label="Color Secundario"
                  type="color"
                  value={brandingConfig.colorSecundario}
                  onChange={(e) => setBrandingConfig({ ...brandingConfig, colorSecundario: e.target.value })}
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  label="Color de Fondo"
                  type="color"
                  value={brandingConfig.colorFondo}
                  onChange={(e) => setBrandingConfig({ ...brandingConfig, colorFondo: e.target.value })}
                  sx={{ mb: 2 }}
                />

                <Box display="flex" gap={2}>
                  <Button
                    variant="contained"
                    onClick={handleSaveBranding}
                    startIcon={<Save />}
                  >
                    Aplicar Cambios
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleResetBranding}
                    startIcon={<Refresh />}
                  >
                    Restaurar
                  </Button>
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, bgcolor: brandingConfig.colorFondo }}>
                  <Typography variant="h6" gutterBottom sx={{ color: brandingConfig.colorPrimario }}>
                    Vista Previa
                  </Typography>
                  <Typography variant="h4" sx={{ color: brandingConfig.colorPrimario, mb: 2 }}>
                    {brandingConfig.nombre}
                  </Typography>
                  <Button
                    variant="contained"
                    sx={{
                      backgroundColor: brandingConfig.colorPrimario,
                      '&:hover': { backgroundColor: brandingConfig.colorSecundario }
                    }}
                  >
                    Botón de Ejemplo
                  </Button>
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </SettingsTabPanel>

        {/* Panel de Notificaciones */}
        <SettingsTabPanel value={activeTab} index={3}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Configuración de Notificaciones
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={notifications.emailNotifications}
                      onChange={(e) => setNotifications({ ...notifications, emailNotifications: e.target.checked })}
                    />
                  }
                  label="Notificaciones por email"
                />
                <Typography variant="body2" color="text.secondary">
                  Recibir notificaciones importantes por correo electrónico
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={notifications.pushNotifications}
                      onChange={(e) => setNotifications({ ...notifications, pushNotifications: e.target.checked })}
                    />
                  }
                  label="Notificaciones push"
                />
                <Typography variant="body2" color="text.secondary">
                  Notificaciones instantáneas en el navegador
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={notifications.reportes}
                      onChange={(e) => setNotifications({ ...notifications, reportes: e.target.checked })}
                    />
                  }
                  label="Reportes semanales"
                />
                <Typography variant="body2" color="text.secondary">
                  Resumen semanal de actividad y estadísticas
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={notifications.alertas}
                      onChange={(e) => setNotifications({ ...notifications, alertas: e.target.checked })}
                    />
                  }
                  label="Alertas de sistema"
                />
                <Typography variant="body2" color="text.secondary">
                  Notificaciones sobre errores y problemas del sistema
                </Typography>
              </Grid>
            </Grid>

            <Box mt={3}>
              <Button variant="contained" startIcon={<Save />}>
                Guardar Preferencias
              </Button>
            </Box>
          </CardContent>
        </SettingsTabPanel>
      </Card>
    </Box>
  );
};

export default SettingsPage;