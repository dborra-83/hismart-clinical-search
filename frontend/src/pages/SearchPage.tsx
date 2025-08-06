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
  relevance_explanation: string;
  contenido_original: string;
  resumen_ia: string;
}

const SearchPage: React.FC = () => {
  const { branding } = useBranding();
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchKeywords, setSearchKeywords] = useState<string[]>([]);
  const [error, setError] = useState<string>('');
  
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
    setError('');
    setResults([]);
    setSearchKeywords([]);

    try {
      console.log('=== INICIANDO BÚSQUEDA INTELIGENTE ===');
      console.log('Query:', query);
      
      // Preparar filtros
      const filters: any = {};
      
      if (fechaDesde) {
        filters.dateFrom = fechaDesde.toISOString().split('T')[0];
      }
      
      if (fechaHasta) {
        filters.dateTo = fechaHasta.toISOString().split('T')[0];
      }
      
      if (especialidad) {
        filters.especialidad = especialidad;
      }
      
      console.log('Filters:', filters);

      // Llamar al endpoint de búsqueda inteligente
      const searchResponse = await fetch('https://jcbisv3pj8.execute-api.us-east-1.amazonaws.com/prod/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: query.trim(),
          filters: filters
        })
      });

      console.log('Search response status:', searchResponse.status);
      console.log('Search response headers:', Object.fromEntries(searchResponse.headers.entries()));

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        console.error('Search API error:', errorText);
        throw new Error(`Búsqueda falló: ${searchResponse.status} - ${errorText}`);
      }

      const searchData = await searchResponse.json();
      console.log('Search response data:', searchData);

      // Procesar resultados
      const searchResults: SearchResult[] = searchData.results.map((item: any) => ({
        id: item.id,
        paciente_id: item.paciente_id,
        fecha_nota: item.fecha_nota,
        medico: item.medico || 'No especificado',
        especialidad: item.especialidad || 'No especificada',
        tipo_nota: item.tipo_nota || 'consulta_externa',
        diagnosticos: Array.isArray(item.diagnosticos) ? item.diagnosticos : [item.diagnosticos || 'Sin diagnóstico'],
        medicamentos: Array.isArray(item.medicamentos) ? item.medicamentos : [item.medicamentos || 'Sin medicamentos'],
        relevance_score: Math.round((item.relevance_score || 0.5) * 100),
        relevance_explanation: item.relevance_explanation || 'Coincidencia con términos de búsqueda',
        contenido_original: item.contenido_original || item.contenido_procesado || 'Sin contenido',
        resumen_ia: item.resumen_ia || 'Sin resumen disponible'
      }));

      setResults(searchResults);
      setSearchKeywords(searchData.searchKeywords || []);
      
      console.log(`Búsqueda completada: ${searchResults.length} resultados encontrados`);

    } catch (error) {
      console.error('=== ERROR EN BÚSQUEDA INTELIGENTE ===');
      console.error('Error details:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(`Error en la búsqueda: ${errorMessage}`);
      
      // Mostrar error al usuario
      alert(`Error en la búsqueda inteligente: ${errorMessage}`);
    } finally {
      setLoading(false);
      setSearched(true);
    }
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
              <LoadingSpinner message="Analizando consulta con IA y buscando en base de datos..." fullScreen={false} />
            )}

            {!loading && !searched && (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <SearchIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  Búsqueda Inteligente con IA
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Ingresa términos de búsqueda para que la IA analice tu consulta y encuentre notas clínicas relevantes
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Powered by Amazon Bedrock Claude
                </Typography>
              </Paper>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {/* Palabras clave generadas por IA */}
            {searchKeywords.length > 0 && (
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    🤖 Palabras clave generadas por IA:
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {searchKeywords.map((keyword, index) => (
                      <Chip
                        key={index}
                        label={keyword}
                        size="small"
                        variant="outlined"
                        color="info"
                      />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            )}

            {!loading && searched && results.length === 0 && !error && (
              <Alert severity="info">
                {branding?.textos?.sin_resultados || 'No se encontraron resultados para tu búsqueda inteligente'}
              </Alert>
            )}

            {!loading && results.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    🔍 Resultados de Búsqueda Inteligente ({results.length})
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Resultados analizados y clasificados por IA según relevancia
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
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            mb: 2,
                            '&:hover': {
                              backgroundColor: 'rgba(0,0,0,0.02)',
                              borderColor: 'primary.main'
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

                          {/* Explicación de relevancia por IA */}
                          <Alert severity="info" sx={{ mb: 2 }}>
                            <Typography variant="body2">
                              <strong>🤖 IA explica por qué es relevante:</strong> {result.relevance_explanation}
                            </Typography>
                          </Alert>

                          {/* Resumen IA */}
                          <Box sx={{ mb: 2, p: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Description fontSize="small" />
                              Resumen IA:
                            </Typography>
                            <Typography variant="body2">
                              {result.resumen_ia}
                            </Typography>
                          </Box>

                          {/* Contenido original preview */}
                          <Typography variant="body2" paragraph sx={{ fontStyle: 'italic' }}>
                            <strong>Contenido:</strong> {result.contenido_original.substring(0, 200)}
                            {result.contenido_original.length > 200 && '...'}
                          </Typography>

                          <Box display="flex" flexWrap="wrap" gap={1} mb={1}>
                            <Typography variant="caption" color="text.secondary">
                              Diagnósticos:
                            </Typography>
                            {Array.isArray(result.diagnosticos) && result.diagnosticos.map((dx, idx) => (
                              <Chip
                                key={idx}
                                label={String(dx)}
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
                            {Array.isArray(result.medicamentos) && result.medicamentos.map((med, idx) => (
                              <Chip
                                key={idx}
                                label={String(med)}
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