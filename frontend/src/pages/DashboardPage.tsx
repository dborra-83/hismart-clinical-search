import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Paper,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Description,
  CloudUpload,
  Search,
  Analytics,
  TrendingUp,
  People,
  Assignment,
  Refresh
} from '@mui/icons-material';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

import { useAuth } from '../contexts/AuthContext';
import { useBranding } from '../contexts/BrandingContext';
import LoadingSpinner from '../components/common/LoadingSpinner';

interface DashboardStats {
  total_notas: number;
  notas_por_especialidad: Record<string, number>;
  notas_por_medico: Record<string, number>;
  notas_por_mes: Record<string, number>;
  estados: Record<string, number>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { branding } = useBranding();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Simular carga de estadísticas (en producción vendría de la API)
  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      
      // Simular delay de API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Datos de ejemplo
      const mockStats: DashboardStats = {
        total_notas: 1247,
        notas_por_especialidad: {
          'Cardiología': 315,
          'Neurología': 287,
          'Endocrinología': 198,
          'Gastroenterología': 156,
          'Dermatología': 142,
          'Pediatría': 149
        },
        notas_por_medico: {
          'Dr. Juan Pérez': 125,
          'Dra. María González': 98,
          'Dr. Carlos Rodríguez': 87,
          'Dra. Ana Martín': 76,
          'Dr. Luis Morales': 69
        },
        notas_por_mes: {
          '2024-01': 456,
          '2024-02': 432,
          '2024-03': 359
        },
        estados: {
          'procesado': 1189,
          'pendiente': 34,
          'error': 24
        }
      };
      
      setStats(mockStats);
      setLoading(false);
      setLastUpdated(new Date());
    };

    loadStats();
  }, []);

  const handleRefresh = () => {
    setStats(null);
    setLoading(true);
    // Recargar estadísticas
    setTimeout(() => {
      setLoading(false);
      setLastUpdated(new Date());
    }, 1000);
  };

  if (loading || !stats) {
    return <LoadingSpinner message="Cargando estadísticas..." />;
  }

  // Preparar datos para gráficos
  const especialidadData = Object.entries(stats.notas_por_especialidad).map(([name, value]) => ({
    name,
    value
  }));

  const medicosData = Object.entries(stats.notas_por_medico)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, value]) => ({
      name: name.replace('Dr. ', '').replace('Dra. ', ''),
      value
    }));

  const quickActions = [
    {
      title: 'Buscar Notas',
      description: 'Búsqueda inteligente de notas clínicas',
      icon: <Search />,
      color: '#2196F3',
      path: '/search'
    },
    {
      title: 'Subir Archivos',
      description: 'Cargar nuevos archivos CSV',
      icon: <CloudUpload />,
      color: '#4CAF50',
      path: '/upload'
    },
    {
      title: 'Análisis IA',
      description: 'Análisis inteligente con Claude',
      icon: <Analytics />,
      color: '#FF9800',
      path: '/analysis'
    },
    {
      title: 'Ver Notas',
      description: 'Explorar todas las notas',
      icon: <Description />,
      color: '#9C27B0',
      path: '/notes'
    }
  ];

  return (
    <Box>
      {/* Header con saludo */}
      <Box mb={4}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h4" sx={{ color: branding?.colores?.primario }}>
              ¡Bienvenido, {user?.name || user?.username}!
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Panel de control - {branding?.nombre || 'HISmart'}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="caption" color="text.secondary">
              Última actualización: {lastUpdated.toLocaleTimeString()}
            </Typography>
            <Tooltip title="Actualizar datos">
              <IconButton onClick={handleRefresh} size="small">
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* Métricas principales */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Total de Notas
                  </Typography>
                  <Typography variant="h4">
                    {stats.total_notas.toLocaleString()}
                  </Typography>
                </Box>
                <Description sx={{ fontSize: 40, color: branding?.colores?.primario }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Especialidades
                  </Typography>
                  <Typography variant="h4">
                    {Object.keys(stats.notas_por_especialidad).length}
                  </Typography>
                </Box>
                <Assignment sx={{ fontSize: 40, color: '#4CAF50' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Médicos Activos
                  </Typography>
                  <Typography variant="h4">
                    {Object.keys(stats.notas_por_medico).length}
                  </Typography>
                </Box>
                <People sx={{ fontSize: 40, color: '#FF9800' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Tasa de Éxito
                  </Typography>
                  <Typography variant="h4">
                    {((stats.estados.procesado / stats.total_notas) * 100).toFixed(1)}%
                  </Typography>
                </Box>
                <TrendingUp sx={{ fontSize: 40, color: '#F44336' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Acciones rápidas */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Acciones Rápidas
          </Typography>
        </Grid>
        {quickActions.map((action, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card 
              sx={{ 
                cursor: 'pointer',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4
                }
              }}
              onClick={() => window.location.href = action.path}
            >
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Box 
                    sx={{ 
                      p: 1, 
                      borderRadius: 2, 
                      backgroundColor: action.color + '20',
                      color: action.color
                    }}
                  >
                    {action.icon}
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {action.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {action.description}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Gráficos */}
      <Grid container spacing={3}>
        {/* Notas por especialidad */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Notas por Especialidad
              </Typography>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={especialidadData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {especialidadData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Top médicos */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top 5 Médicos (Notas Creadas)
              </Typography>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={medicosData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="value" fill={branding?.colores?.primario || '#0D47A1'} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Estado de procesamiento */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Estado de Procesamiento
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={2} mt={2}>
                {Object.entries(stats.estados).map(([estado, count]) => (
                  <Chip
                    key={estado}
                    label={`${estado}: ${count}`}
                    color={
                      estado === 'procesado' ? 'success' :
                      estado === 'pendiente' ? 'warning' : 'error'
                    }
                    variant="outlined"
                  />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Información del usuario */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Información de Sesión
              </Typography>
              <Box mt={2}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Usuario:</strong> {user?.username}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Nombre:</strong> {user?.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Email:</strong> {user?.email}
                </Typography>
                {user?.especialidad && (
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Especialidad:</strong> {user.especialidad}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Rol:</strong> {user?.rol || 'Médico'}
                </Typography>
                <Box mt={2}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Grupos:</strong>
                  </Typography>
                  {user?.groups.map((group) => (
                    <Chip
                      key={group}
                      label={group}
                      size="small"
                      sx={{ mr: 1, mb: 1 }}
                    />
                  ))}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage;