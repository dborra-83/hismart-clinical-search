import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Search,
  Visibility,
  Analytics,
  FilterList
} from '@mui/icons-material';

import { useBranding } from '../contexts/BrandingContext';
import LoadingSpinner from '../components/common/LoadingSpinner';

interface ClinicalNote {
  id: string;
  paciente_id: string;
  fecha_nota: string;
  medico: string;
  especialidad: string;
  tipo_nota: string;
  diagnosticos: string[];
  medicamentos: string[];
  contenido_original: string;
  resumen_ia?: string;
  estado: string;
  fecha_carga: string;
}

const NotesPage: React.FC = () => {
  const { branding } = useBranding();
  
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedNote, setSelectedNote] = useState<ClinicalNote | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Cargar notas reales
  useEffect(() => {
    const loadNotes = async () => {
      setLoading(true);
      
      try {
        console.log('Loading notes from API...');
        const response = await fetch('https://jcbisv3pj8.execute-api.us-east-1.amazonaws.com/prod/notes', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Notes API response:', data);
          console.log('Individual notes:', data.notas);
          
          // Debug each note
          if (data.notas && Array.isArray(data.notas)) {
            data.notas.forEach((note: any, index: number) => {
              console.log(`Note ${index}:`, note);
              console.log(`Note ${index} diagnosticos:`, note.diagnosticos, typeof note.diagnosticos);
              console.log(`Note ${index} medicamentos:`, note.medicamentos, typeof note.medicamentos);
            });
          }
          
          setNotes(data.notas || []);
        } else {
          console.error('Failed to load notes:', response.status);
          // Fallback to mock data if API fails
          const mockNotes: ClinicalNote[] = [
        {
          id: '1',
          paciente_id: '12345',
          fecha_nota: '2024-01-15',
          medico: 'Dr. Juan Pérez',
          especialidad: 'Cardiología',
          tipo_nota: 'consulta_externa',
          diagnosticos: ['Hipertensión arterial'],
          medicamentos: ['Losartán 50mg cada 24 horas'],
          contenido_original: 'Paciente masculino de 65 años que acude por control rutinario de hipertensión arterial. Refiere adherencia al tratamiento farmacológico. Tensión arterial: 130/80 mmHg. Frecuencia cardíaca: 72 lpm. Paciente estable, continuar con tratamiento actual y control en 3 meses.',
          resumen_ia: 'Control rutinario de hipertensión. Paciente estable con buen control tensional. Continuar tratamiento actual.',
          estado: 'procesado',
          fecha_carga: '2024-01-15T10:30:00Z'
        },
        {
          id: '2',
          paciente_id: '12346',
          fecha_nota: '2024-01-15',
          medico: 'Dra. María González',
          especialidad: 'Endocrinología',
          tipo_nota: 'consulta_externa',
          diagnosticos: ['Diabetes mellitus tipo 2', 'Sobrepeso'],
          medicamentos: ['Metformina 850mg cada 12 horas', 'Glibenclamida 5mg cada 24 horas'],
          contenido_original: 'Paciente femenina de 58 años con diabetes mellitus tipo 2. Acude para evaluación de control glicémico. HbA1c: 7.2%. Glucemia en ayunas: 140 mg/dl. Se ajusta tratamiento hipoglicemiante y se refuerza educación sobre dieta y ejercicio.',
          resumen_ia: 'Control diabético subóptimo. Ajuste de medicación y refuerzo educacional sobre estilo de vida.',
          estado: 'procesado',
          fecha_carga: '2024-01-15T11:00:00Z'
        },
        {
          id: '3',
          paciente_id: '12347',
          fecha_nota: '2024-01-16',
          medico: 'Dr. Carlos Rodríguez',
          especialidad: 'Neurología',
          tipo_nota: 'consulta_externa',
          diagnosticos: ['Cefalea tensional'],
          medicamentos: ['Amitriptilina 25mg cada noche', 'Ibuprofeno 400mg según necesidad'],
          contenido_original: 'Paciente de 45 años consulta por cefaleas recurrentes de 3 meses de evolución. Cefalea tensional, pulsar, hemicraneal derecha, intensidad 7/10, duración 4-6 horas. Examen neurológico normal. Se inicia tratamiento profiláctico.',
          resumen_ia: 'Cefalea tensional de 3 meses. Examen neurológico normal. Inicio de tratamiento profiláctico con amitriptilina.',
          estado: 'procesado',
          fecha_carga: '2024-01-16T09:15:00Z'
        },
        // Agregar más notas de ejemplo...
      ];
      
      setNotes(mockNotes);
        }
      } catch (error) {
        console.error('Error loading notes:', error);
        setNotes([]);
      } finally {
        setLoading(false);
      }
    };

    loadNotes();
  }, []);

  // Filtrar notas según término de búsqueda
  const filteredNotes = notes.filter(note => {
    const searchLower = searchTerm.toLowerCase();
    return (
      note.paciente_id.toLowerCase().includes(searchLower) ||
      note.medico.toLowerCase().includes(searchLower) ||
      note.especialidad.toLowerCase().includes(searchLower) ||
      note.diagnosticos.some(d => d.toLowerCase().includes(searchLower)) ||
      note.contenido_original.toLowerCase().includes(searchLower)
    );
  });

  // Paginación
  const paginatedNotes = filteredNotes.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleViewNote = (note: ClinicalNote) => {
    setSelectedNote(note);
    setDetailOpen(true);
  };

  const handleAnalyzeNote = (note: ClinicalNote) => {
    console.log('Analizar nota:', note.id);
    // Navegar a página de análisis
  };

  const getStatusChip = (estado: string) => {
    const colors = {
      'procesado': 'success',
      'pendiente': 'warning',
      'error': 'error'
    } as const;

    return (
      <Chip
        label={estado}
        color={colors[estado as keyof typeof colors] || 'default'}
        size="small"
      />
    );
  };

  if (loading) {
    return <LoadingSpinner message="Cargando notas clínicas..." />;
  }

  return (
    <Box>
      {/* Header */}
      <Box mb={4}>
        <Typography variant="h4" gutterBottom sx={{ color: branding?.colores?.primario }}>
          Notas Clínicas
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Explora y gestiona todas las notas clínicas del sistema
        </Typography>
      </Box>

      {/* Estadísticas rápidas */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total de Notas
              </Typography>
              <Typography variant="h4">
                {notes.length.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Procesadas Exitosamente
              </Typography>
              <Typography variant="h4">
                {notes.filter(n => n.estado === 'procesado').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Especialidades
              </Typography>
              <Typography variant="h4">
                {new Set(notes.map(n => n.especialidad)).size}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Médicos
              </Typography>
              <Typography variant="h4">
                {new Set(notes.map(n => n.medico)).size}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Búsqueda y tabla */}
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6">
              Lista de Notas
            </Typography>
            <TextField
              size="small"
              placeholder="Buscar notas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              sx={{ width: 300 }}
            />
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Paciente</TableCell>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Médico</TableCell>
                  <TableCell>Especialidad</TableCell>
                  <TableCell>Diagnósticos</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedNotes.map((note) => (
                  <TableRow key={note.id} hover>
                    <TableCell>{String(note.paciente_id)}</TableCell>
                    <TableCell>
                      {new Date(note.fecha_nota).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{String(note.medico)}</TableCell>
                    <TableCell>
                      <Chip label={String(note.especialidad)} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {Array.isArray(note.diagnosticos) && note.diagnosticos.slice(0, 2).map((dx, idx) => (
                          <Chip key={idx} label={String(dx)} size="small" />
                        ))}
                        {Array.isArray(note.diagnosticos) && note.diagnosticos.length > 2 && (
                          <Chip
                            label={`+${note.diagnosticos.length - 2}`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {getStatusChip(note.estado)}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleViewNote(note)}
                        title="Ver detalle"
                      >
                        <Visibility />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleAnalyzeNote(note)}
                        title="Analizar con IA"
                      >
                        <Analytics />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={filteredNotes.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            labelRowsPerPage="Filas por página:"
            labelDisplayedRows={({ from, to, count }) => 
              `${from}-${to} de ${count !== -1 ? count : `más de ${to}`}`
            }
          />
        </CardContent>
      </Card>

      {/* Dialog de detalle */}
      <Dialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Detalle de Nota Clínica - Paciente {selectedNote?.paciente_id}
        </DialogTitle>
        <DialogContent>
          {selectedNote && (
            <Box>
              <Grid container spacing={2} mb={3}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Fecha de la nota:
                  </Typography>
                  <Typography variant="body1">
                    {new Date(selectedNote.fecha_nota).toLocaleDateString()}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Médico:
                  </Typography>
                  <Typography variant="body1">
                    {selectedNote.medico}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Especialidad:
                  </Typography>
                  <Typography variant="body1">
                    {selectedNote.especialidad}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Tipo de consulta:
                  </Typography>
                  <Typography variant="body1">
                    {selectedNote.tipo_nota}
                  </Typography>
                </Grid>
              </Grid>

              <Box mb={3}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Diagnósticos:
                </Typography>
                <Box display="flex" flexWrap="wrap" gap={1}>
                  {Array.isArray(selectedNote.diagnosticos) && selectedNote.diagnosticos.map((dx, idx) => (
                    <Chip key={idx} label={String(dx)} color="primary" />
                  ))}
                </Box>
              </Box>

              <Box mb={3}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Medicamentos:
                </Typography>
                <Box display="flex" flexWrap="wrap" gap={1}>
                  {Array.isArray(selectedNote.medicamentos) && selectedNote.medicamentos.map((med, idx) => (
                    <Chip key={idx} label={String(med)} color="secondary" />
                  ))}
                </Box>
              </Box>

              {selectedNote.resumen_ia && (
                <Box mb={3}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Resumen con IA:
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="body2">
                      {selectedNote.resumen_ia}
                    </Typography>
                  </Paper>
                </Box>
              )}

              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Contenido completo:
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'grey.50', maxHeight: 200, overflow: 'auto' }}>
                  <Typography variant="body2">
                    {selectedNote.contenido_original}
                  </Typography>
                </Paper>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>
            Cerrar
          </Button>
          <Button
            variant="contained"
            startIcon={<Analytics />}
            onClick={() => {
              if (selectedNote) handleAnalyzeNote(selectedNote);
              setDetailOpen(false);
            }}
          >
            Analizar con IA
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NotesPage;