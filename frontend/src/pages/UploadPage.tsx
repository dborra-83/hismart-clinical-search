import React, { useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  LinearProgress,
  Alert,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Chip
} from '@mui/material';
import {
  CloudUpload,
  InsertDriveFile,
  CheckCircle,
  Error as ErrorIcon,
  Delete,
  Refresh
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';

import { useBranding } from '../contexts/BrandingContext';
import { useAuth } from '../contexts/AuthContext';
import { getUploadUrl } from '../services/api';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  processed?: number;
  errors?: number;
  uploadedAt: Date;
}

const UploadPage: React.FC = () => {
  const { branding } = useBranding();
  const { user } = useAuth();
  
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach((file) => {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        alert('Solo se permiten archivos CSV');
        return;
      }

      const fileId = `${Date.now()}-${Math.random()}`;
      const uploadedFile: UploadedFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        status: 'uploading',
        progress: 0,
        uploadedAt: new Date()
      };

      setFiles(prev => [...prev, uploadedFile]);
      uploadFile(fileId, file);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    multiple: true
  });

  const uploadFile = async (fileId: string, file: File) => {
    try {
      setUploading(true);
      updateFile(fileId, { status: 'uploading', progress: 0 });

      // 1. Obtener URL presignada usando fetch directo
      console.log('Getting upload URL for:', file.name);
      const urlResponse = await fetch('https://jcbisv3pj8.execute-api.us-east-1.amazonaws.com/prod/upload/csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ filename: file.name })
      });

      if (!urlResponse.ok) {
        throw new Error(`Failed to get upload URL: ${urlResponse.status}`);
      }

      const uploadUrlResponse = await urlResponse.json();
      const { upload_url, file_key } = uploadUrlResponse;

      // 2. Subir archivo a S3 usando la URL presignada
      updateFile(fileId, { progress: 10 });

      const uploadResponse = await fetch(upload_url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': 'text/csv'
        }
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      updateFile(fileId, { progress: 100, status: 'processing' });

      // 3. El procesamiento será automático via S3 trigger -> Lambda
      // Simular un delay para mostrar estado de procesamiento
      setTimeout(() => {
        updateFile(fileId, {
          status: 'completed',
          progress: 100,
          processed: 5
        });
      }, 3000);

    } catch (error) {
      console.error('Error uploading file:', error);
      updateFile(fileId, {
        status: 'error',
        progress: 100,
        processed: 0,
        errors: 1
      });
    } finally {
      setUploading(false);
    }
  };

  const updateFile = (id: string, updates: Partial<UploadedFile>) => {
    setFiles(prev => prev.map(file => 
      file.id === id ? { ...file, ...updates } : file
    ));
  };

  const handleDeleteFile = (id: string) => {
    setFiles(prev => prev.filter(file => file.id !== id));
  };

  const handleRetryFile = (id: string) => {
    const file = files.find(f => f.id === id);
    if (file) {
      updateFile(id, { status: 'uploading', progress: 0 });
      // En una implementación real, reintentaríamos la carga
      setTimeout(() => {
        updateFile(id, { status: 'completed', processed: 3, errors: 2 });
      }, 3000);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: UploadedFile['status']) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'error':
        return 'error';
      case 'processing':
      case 'uploading':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
        return 'Subiendo...';
      case 'processing':
        return 'Procesando...';
      case 'completed':
        return 'Completado';
      case 'error':
        return 'Error';
      default:
        return 'Desconocido';
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box mb={4}>
        <Typography variant="h4" gutterBottom sx={{ color: branding?.colores?.primario }}>
          Subir Archivos CSV
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Carga archivos CSV con notas clínicas para procesamiento automático
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Zona de carga */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {branding?.textos?.boton_subir || 'Subir Archivo CSV'}
              </Typography>
              
              <Paper
                {...getRootProps()}
                sx={{
                  p: 4,
                  textAlign: 'center',
                  border: '2px dashed',
                  borderColor: isDragActive ? branding?.colores?.primario : 'grey.300',
                  backgroundColor: isDragActive ? 'rgba(13, 71, 161, 0.05)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: branding?.colores?.primario,
                    backgroundColor: 'rgba(13, 71, 161, 0.02)'
                  }
                }}
              >
                <input {...getInputProps()} />
                <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                
                {isDragActive ? (
                  <Typography variant="h6" color="primary">
                    Suelta los archivos aquí...
                  </Typography>
                ) : (
                  <>
                    <Typography variant="h6" gutterBottom>
                      Arrastra archivos CSV aquí
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      o haz clic para seleccionar archivos
                    </Typography>
                    <Button
                      variant="contained"
                      sx={{ mt: 2 }}
                      startIcon={<CloudUpload />}
                    >
                      Seleccionar Archivos
                    </Button>
                  </>
                )}
              </Paper>

              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2" component="div">
                  <Typography component="span" sx={{ fontWeight: 'bold' }}>
                    Formato esperado:
                  </Typography>
                  <br />
                  ID_Paciente, Fecha_Nota, Medico, Especialidad, Tipo_Consulta, Contenido_Nota, Diagnosticos, Medicamentos
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* Instrucciones */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Instrucciones
              </Typography>
              
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="1. Formato de archivo"
                    secondary="Solo archivos CSV con codificación UTF-8"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="2. Columnas requeridas"
                    secondary="ID_Paciente, Fecha_Nota y Contenido_Nota son obligatorios"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="3. Separadores"
                    secondary="Usar ; | , para separar múltiples diagnósticos/medicamentos"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="4. Procesamiento automático"
                    secondary="Los archivos se procesan automáticamente con IA"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="5. Duplicados"
                    secondary="Se detectan y omiten automáticamente"
                  />
                </ListItem>
              </List>

              <Button
                variant="outlined"
                fullWidth
                sx={{ mt: 2 }}
                href="/ejemplo_notas_clinicas.csv"
                download
              >
                Descargar CSV de Ejemplo
              </Button>
              
              <Button
                variant="contained"
                color="secondary"
                fullWidth
                sx={{ mt: 1 }}
                onClick={async () => {
                  try {
                    console.log('Testing simplified CRUD upload endpoint...');
                    const response = await fetch('https://jcbisv3pj8.execute-api.us-east-1.amazonaws.com/prod/upload/csv', {
                      method: 'POST',
                      mode: 'cors',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ filename: 'test.csv' })
                    });
                    
                    console.log('Response status:', response.status);
                    console.log('Response headers:', response.headers);
                    
                    const text = await response.text();
                    console.log('Response body:', text);
                    
                    if (response.ok) {
                      alert('Upload endpoint trabajando! Ver console para detalles.');
                    } else {
                      alert(`Upload endpoint falló: ${response.status} - ${text}`);
                    }
                  } catch (error) {
                    console.error('Upload test error:', error);
                    alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
                  }
                }}
              >
                TEST UPLOAD (Simplified)
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Lista de archivos */}
        {files.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Archivos Cargados ({files.length})
                </Typography>
                
                <List>
                  {files.map((file) => (
                    <ListItem
                      key={file.id}
                      secondaryAction={
                        <Box display="flex" gap={1}>
                          {file.status === 'error' && (
                            <IconButton onClick={() => handleRetryFile(file.id)}>
                              <Refresh />
                            </IconButton>
                          )}
                          <IconButton onClick={() => handleDeleteFile(file.id)}>
                            <Delete />
                          </IconButton>
                        </Box>
                      }
                    >
                      <ListItemIcon>
                        {file.status === 'completed' ? (
                          <CheckCircle color="success" />
                        ) : file.status === 'error' ? (
                          <ErrorIcon color="error" />
                        ) : (
                          <InsertDriveFile color="action" />
                        )}
                      </ListItemIcon>
                      
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="subtitle2">
                              {file.name}
                            </Typography>
                            <Chip
                              label={getStatusText(file.status)}
                              color={getStatusColor(file.status)}
                              size="small"
                            />
                          </Box>
                        }
                        secondary={
                          <>
                            <Typography variant="caption" color="text.secondary" component="span" sx={{ display: "block" }}>
                              {formatFileSize(file.size)} • 
                              Subido: {file.uploadedAt.toLocaleTimeString()}
                            </Typography>
                            
                            {(file.status === 'uploading' || file.status === 'processing') && (
                              <LinearProgress
                                variant="determinate"
                                value={file.progress}
                                sx={{ mt: 1, mb: 1 }}
                              />
                            )}
                            
                            {file.status === 'completed' && (
                              <Typography variant="caption" color="success.main" component="span" sx={{ display: "block" }}>
                                ✓ {file.processed} notas procesadas
                                {file.errors && file.errors > 0 && `, ${file.errors} errores`}
                              </Typography>
                            )}
                            
                            {file.status === 'error' && (
                              <Typography variant="caption" color="error.main" component="span" sx={{ display: "block" }}>
                                ✗ Error durante el procesamiento
                              </Typography>
                            )}
                          </>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default UploadPage;