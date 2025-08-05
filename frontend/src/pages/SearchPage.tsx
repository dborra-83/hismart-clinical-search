import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Grid,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { es } from 'date-fns/locale';
import {
  Search as SearchIcon,
  FilterList,
  Clear,
  Analytics,
  Description
} from '@mui/icons-material';

import { useBranding } from '../contexts/BrandingContext';
import LoadingSpinner from '../components/common/LoadingSpinner';

interface SearchResult {
  id: string;
  paciente_id: string;
  fecha_nota: string;
  medico: string;
  especialidad: string;
  tipo_nota: string;
  diagnosticos: string[];
  medicamentos: string[];
  relevance_score: number;
  contenido_preview: string;
}

const SearchPage: React.FC = () => {
  const { branding } = useBranding();
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  
  // Filtros
  const [especialidad, setEspecialidad] = useState('');
  const [fechaDesde, setFechaDesde] = useState<Date | null>(null);
  const [fechaHasta, setFechaHasta] = useState<Date | null>(null);
  const [medico, setMedico] = useState('');

  const especialidades = [
    'Cardiología',
    'Neurología', 
    'Endocrinología',
    'Gastroenterología',
    'Dermatología',
    'Pediatría',
    'Medicina Interna',
    'Ginecología'
  ];

  const medicos = [
    'Dr. Juan Pérez',
    'Dra. María González', 
    'Dr. Carlos Rodríguez',
    'Dra. Ana Martín',
    'Dr. Luis Morales',
    'Dra. Patricia Silva',
    'Dr. Roberto Herrera',
    'Dra. Carmen Vega'
  ];

  const handleSearch = async () => {
    if (!query.trim()) {
      return;
    }

    setLoading(true);
    setSearched(false);

    // Simular búsqueda (en producción sería llamada a API)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Resultados de ejemplo
    const mockResults: SearchResult[] = [
      {
        id: '1',
        paciente_id: '12345',
        fecha_nota: '2024-01-15',
        medico: 'Dr. Juan Pérez',
        especialidad: 'Cardiología',
        tipo_nota: 'consulta_externa',
        diagnosticos: ['Hipertensión arterial'],
        medicamentos: ['Losartán 50mg'],
        relevance_score: 95,
        contenido_preview: 'Paciente masculino de 65 años que acude por control rutinario de hipertensión arterial...'
      },
      {
        id: '2', 
        paciente_id: '12346',
        fecha_nota: '2024-01-15',
        medico: 'Dra. María González',
        especialidad: 'Endocrinología',
        tipo_nota: 'consulta_externa',
        diagnosticos: ['Diabetes mellitus tipo 2', 'Sobrepeso'],
        medicamentos: ['Metformina 850mg', 'Glibenclamida 5mg'],
        relevance_score: 87,
        contenido_preview: 'Paciente femenina de 58 años con diabetes mellitus tipo 2. Acude para evaluación...'
      },
      {
        id: '3',
        paciente_id: '12347', 
        fecha_nota: '2024-01-16',
        medico: 'Dr. Carlos Rodríguez',
        especialidad: 'Neurología',
        tipo_nota: 'consulta_externa',
        diagnosticos: ['Cefalea tensional'],
        medicamentos: ['Amitriptilina 25mg', 'Ibuprofeno 400mg'],
        relevance_score: 78,
        contenido_preview: 'Paciente de 45 años consulta por cefaleas recurrentes de 3 meses de evolución...'
      }
    ];

    // Filtrar resultados según query
    const filteredResults = mockResults.filter(result => {
      const searchTerms = query.toLowerCase().split(' ');
      const searchableText = [
        result.contenido_preview,
        result.diagnosticos.join(' '),
        result.medicamentos.join(' '),
        result.especialidad,
        result.medico
      ].join(' ').toLowerCase();

      return searchTerms.some(term => searchableText.includes(term));
    });

    setResults(filteredResults);
    setLoading(false);
    setSearched(true);
  };

  const handleClearFilters = () => {
    setEspecialidad('');
    setFechaDesde(null);
    setFechaHasta(null);
    setMedico('');
  };

  const handleAnalyzeResult = (result: SearchResult) => {
    // Navegar a página de análisis con la nota seleccionada
    console.log('Analizar nota:', result.id);
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 90) return 'success';
    if (score >= 70) return 'warning';
    return 'error';
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
      <Box>
        {/* Header */}
        <Box mb={4}>
          <Typography variant="h4" gutterBottom sx={{ color: branding?.colores?.primario }}>
            {branding?.textos?.titulo_busqueda || 'Búsqueda Inteligente de Notas Clínicas'}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {branding?.textos?.subtitulo_busqueda || 'Encuentra información clínica relevante con IA'}
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Panel de búsqueda y filtros */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Búsqueda
                </Typography>
                
                <TextField
                  fullWidth
                  label={branding?.textos?.placeholder_busqueda || "Términos de búsqueda"}
                  variant="outlined"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  sx={{ mb: 2 }}
                  InputProps={{
                    endAdornment: (
                      <SearchIcon color="action" />
                    )
                  }}
                />

                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleSearch}
                  disabled={!query.trim() || loading}
                  startIcon={<SearchIcon />}
                  sx={{ mb: 3 }}
                >
                  {loading ? branding?.textos?.loading || 'Buscando...' : branding?.textos?.boton_buscar || 'Buscar'}
                </Button>

                <Divider sx={{ mb: 2 }} />

                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <FilterList />
                  <Typography variant="h6">
                    Filtros
                  </Typography>
                  <Button
                    size="small"
                    onClick={handleClearFilters}
                    startIcon={<Clear />}
                  >
                    Limpiar
                  </Button>
                </Box>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Especialidad</InputLabel>
                  <Select
                    value={especialidad}
                    label="Especialidad"
                    onChange={(e) => setEspecialidad(e.target.value)}
                  >
                    <MenuItem value="">Todas</MenuItem>
                    {especialidades.map((esp) => (
                      <MenuItem key={esp} value={esp}>
                        {esp}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Médico</InputLabel>
                  <Select
                    value={medico}
                    label="Médico"
                    onChange={(e) => setMedico(e.target.value)}
                  >
                    <MenuItem value="">Todos</MenuItem>
                    {medicos.map((med) => (
                      <MenuItem key={med} value={med}>
                        {med}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <DatePicker
                  label="Fecha desde"
                  value={fechaDesde}
                  onChange={(newValue: Date | null) => setFechaDesde(newValue)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      sx: { mb: 2 }
                    }
                  }}
                />

                <DatePicker
                  label="Fecha hasta"
                  value={fechaHasta}
                  onChange={(newValue: Date | null) => setFechaHasta(newValue)}
                  slotProps={{
                    textField: {
                      fullWidth: true
                    }
                  }}
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Resultados */}
          <Grid item xs={12} md={8}>
            {loading && (
              <LoadingSpinner message="Buscando notas clínicas..." fullScreen={false} />
            )}

            {!loading && !searched && (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <SearchIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  Ingresa términos de búsqueda para comenzar
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Puedes buscar por síntomas, diagnósticos, medicamentos o contenido de notas
                </Typography>
              </Paper>
            )}

            {!loading && searched && results.length === 0 && (
              <Alert severity="info">
                {branding?.textos?.sin_resultados || 'No se encontraron resultados para tu búsqueda'}
              </Alert>
            )}

            {!loading && results.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Resultados ({results.length})
                  </Typography>
                  
                  <List>
                    {results.map((result, index) => (
                      <React.Fragment key={result.id}>
                        <ListItem
                          alignItems="flex-start"
                          sx={{
                            flexDirection: 'column',
                            alignItems: 'stretch',
                            p: 2,
                            '&:hover': {
                              backgroundColor: 'rgba(0,0,0,0.02)'
                            }
                          }}
                        >
                          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                            <Box>
                              <Typography variant="subtitle1" fontWeight={600}>
                                Paciente {result.paciente_id} - {result.fecha_nota}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {result.medico} • {result.especialidad}
                              </Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Chip
                                label={`${result.relevance_score}% relevante`}
                                color={getRelevanceColor(result.relevance_score)}
                                size="small"
                              />
                              <Button
                                size="small"
                                startIcon={<Analytics />}
                                onClick={() => handleAnalyzeResult(result)}
                              >
                                Analizar
                              </Button>
                            </Box>
                          </Box>

                          <Typography variant="body2" paragraph>
                            {result.contenido_preview}...
                          </Typography>

                          <Box display="flex" flexWrap="wrap" gap={1} mb={1}>
                            <Typography variant="caption" color="text.secondary">
                              Diagnósticos:
                            </Typography>
                            {result.diagnosticos.map((dx, idx) => (
                              <Chip
                                key={idx}
                                label={dx}
                                size="small"
                                variant="outlined"
                                color="primary"
                              />
                            ))}
                          </Box>

                          <Box display="flex" flexWrap="wrap" gap={1}>
                            <Typography variant="caption" color="text.secondary">
                              Medicamentos:
                            </Typography>
                            {result.medicamentos.map((med, idx) => (
                              <Chip
                                key={idx}
                                label={med}
                                size="small"
                                variant="outlined"
                                color="secondary"
                              />
                            ))}
                          </Box>
                        </ListItem>
                        {index < results.length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                </CardContent>
              </Card>
            )}
          </Grid>
        </Grid>
      </Box>
    </LocalizationProvider>
  );
};

export default SearchPage;