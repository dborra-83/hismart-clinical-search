import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Paper,
  Chip,
  Alert,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Analytics,
  Psychology,
  Assignment,
  TrendingUp
} from '@mui/icons-material';

import { useBranding } from '../contexts/BrandingContext';
import LoadingSpinner from '../components/common/LoadingSpinner';

interface AnalysisResult {
  tipo: 'completo' | 'resumen' | 'riesgo' | 'extraccion';
  resultado: string;
  timestamp: string;
}

const AnalysisPage: React.FC = () => {
  const { branding } = useBranding();
  
  const [activeTab, setActiveTab] = useState(0);
  const [contenido, setContenido] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [tipoAnalisis, setTipoAnalisis] = useState<'completo' | 'resumen' | 'riesgo' | 'extraccion'>('completo');

  const sampleNote = `Paciente femenina de 58 años con diabetes mellitus tipo 2. Acude para evaluación de control glicémico. 
  
Antecedentes: 
- Diabetes mellitus tipo 2 diagnosticada hace 8 años
- Hipertensión arterial en tratamiento
- Sobrepeso (IMC 28.5)
- Antecedente familiar de diabetes (madre)

Examen físico:
- PA: 140/85 mmHg
- FC: 78 lpm  
- Peso: 72 kg, Talla: 1.60 m
- Examen cardiovascular normal
- Extremidades: sin edemas

Laboratorios:
- HbA1c: 8.2% (meta <7%)
- Glucemia en ayunas: 165 mg/dl
- Creatinina: 0.9 mg/dl
- Colesterol total: 220 mg/dl

Plan:
1. Ajuste de medicación hipoglicemiante
2. Refuerzo educacional sobre dieta y ejercicio
3. Control en 3 meses
4. Evaluación oftalmológica anual`;

  const handleAnalyze = async () => {
    if (!contenido.trim()) {
      return;
    }

    setLoading(true);
    
    // Simular análisis con IA
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    let resultado = '';
    
    switch (tipoAnalisis) {
      case 'completo':
        resultado = `**ANÁLISIS CLÍNICO COMPLETO**

**1. Diagnóstico principal:**
Diabetes mellitus tipo 2 descompensada

**2. Problemas asociados:**
- Hipertensión arterial
- Sobrepeso (IMC 28.5)
- Control glicémico subóptimo (HbA1c 8.2%)

**3. Medicamentos mencionados:**
No se especifican medicamentos actuales en la nota

**4. Recomendaciones clave:**
- Intensificar tratamiento hipoglicemiante
- Implementar plan nutricional estructurado
- Aumentar actividad física supervisada
- Monitoreo domiciliario de glucemia

**5. Seguimiento requerido:**
- Control médico en 3 meses
- Evaluación oftalmológica anual
- Monitoreo de función renal semestral`;
        break;
        
      case 'resumen':
        resultado = `**RESUMEN EJECUTIVO**

Paciente de 58 años con diabetes tipo 2 de 8 años de evolución presenta descompensación metabólica con HbA1c 8.2%. Asocia hipertensión arterial y sobrepeso. Requiere intensificación del tratamiento hipoglicemiante, refuerzo educacional y seguimiento estrecho en 3 meses.`;
        break;
        
      case 'riesgo':
        resultado = `**EVALUACIÓN DE RIESGO: MEDIO-ALTO**

**Factores de riesgo identificados:**
- HbA1c elevada (8.2%) - Riesgo de complicaciones microvasculares
- Hipertensión arterial no controlada (140/85 mmHg)
- Sobrepeso persistente (IMC 28.5)
- Tiempo de evolución de diabetes (8 años)
- Antecedente familiar de diabetes

**Justificación:**
La combinación de control glicémico subóptimo, hipertensión y sobrepeso coloca a la paciente en riesgo medio-alto para desarrollo de complicaciones diabéticas. Requiere intervención inmediata para reducir riesgo cardiovascular.`;
        break;
        
      case 'extraccion':
        resultado = `{
  "edad_paciente": "58 años",
  "sexo": "femenino",
  "diagnostico_principal": "Diabetes mellitus tipo 2 descompensada",
  "diagnosticos_secundarios": ["Hipertensión arterial", "Sobrepeso"],
  "medicamentos_actuales": [],
  "alergias": null,
  "signos_vitales": {
    "presion_arterial": "140/85 mmHg",
    "frecuencia_cardiaca": "78 lpm",
    "peso": "72 kg",
    "talla": "1.60 m",
    "imc": "28.5"
  },
  "laboratorios": {
    "hba1c": "8.2%",
    "glucemia_ayunas": "165 mg/dl",
    "creatinina": "0.9 mg/dl",
    "colesterol_total": "220 mg/dl"
  },
  "plan_tratamiento": [
    "Ajuste de medicación hipoglicemiante",
    "Refuerzo educacional sobre dieta y ejercicio",
    "Control en 3 meses",
    "Evaluación oftalmológica anual"
  ]
}`;
        break;
    }
    
    setResult({
      tipo: tipoAnalisis,
      resultado,
      timestamp: new Date().toISOString()
    });
    
    setLoading(false);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleUseExample = () => {
    setContenido(sampleNote);
  };

  const handleClear = () => {
    setContenido('');
    setResult(null);
  };

  return (
    <Box>
      {/* Header */}
      <Box mb={4}>
        <Typography variant="h4" gutterBottom sx={{ color: branding?.colores?.primario }}>
          Análisis Inteligente con IA
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Analiza notas clínicas usando Amazon Bedrock Claude para obtener insights médicos
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Panel de entrada */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Contenido a Analizar
              </Typography>
              
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Tipo de Análisis</InputLabel>
                <Select
                  value={tipoAnalisis}
                  label="Tipo de Análisis"
                  onChange={(e) => setTipoAnalisis(e.target.value as any)}
                >
                  <MenuItem value="completo">Análisis Completo</MenuItem>
                  <MenuItem value="resumen">Resumen Ejecutivo</MenuItem>
                  <MenuItem value="riesgo">Evaluación de Riesgo</MenuItem>
                  <MenuItem value="extraccion">Extracción de Datos</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                multiline
                rows={15}
                label="Nota clínica"
                placeholder="Pega aquí el contenido de la nota clínica a analizar..."
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                sx={{ mb: 2 }}
              />

              <Box display="flex" gap={2} mb={2}>
                <Button
                  variant="contained"
                  onClick={handleAnalyze}
                  disabled={!contenido.trim() || loading}
                  startIcon={<Analytics />}
                  fullWidth
                >
                  {loading ? branding?.textos?.loading || 'Analizando...' : branding?.textos?.boton_analizar || 'Analizar con IA'}
                </Button>
              </Box>

              <Box display="flex" gap={1}>
                <Button
                  size="small"
                  onClick={handleUseExample}
                  disabled={loading}
                >
                  Usar Ejemplo
                </Button>
                <Button
                  size="small"
                  onClick={handleClear}
                  disabled={loading}
                >
                  Limpiar
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Panel de resultados */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Resultado del Análisis
              </Typography>

              {loading && (
                <LoadingSpinner message="Analizando con Claude..." fullScreen={false} />
              )}

              {!loading && !result && (
                <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
                  <Psychology sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    Análisis con IA
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Ingresa una nota clínica y selecciona el tipo de análisis para obtener insights médicos generados por IA
                  </Typography>
                </Paper>
              )}

              {!loading && result && (
                <Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Chip
                      label={result.tipo}
                      color="primary"
                      icon={<Analytics />}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {new Date(result.timestamp).toLocaleString()}
                    </Typography>
                  </Box>

                  <Paper sx={{ p: 3, bgcolor: 'grey.50' }}>
                    <Typography
                      variant="body2"
                      component="pre"
                      sx={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontFamily: 'inherit'
                      }}
                    >
                      {result.resultado}
                    </Typography>
                  </Paper>

                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      <strong>Importante:</strong> Este análisis es generado por IA y debe ser revisado por un profesional médico. 
                      No reemplaza el juicio clínico profesional.
                    </Typography>
                  </Alert>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Información sobre tipos de análisis */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Tipos de Análisis Disponibles
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <Paper sx={{ p: 2, height: '100%' }}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Assignment color="primary" />
                      <Typography variant="subtitle1" fontWeight={600}>
                        Análisis Completo
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Extrae diagnóstico principal, problemas asociados, medicamentos y recomendaciones clave de la nota clínica.
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Paper sx={{ p: 2, height: '100%' }}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Psychology color="secondary" />
                      <Typography variant="subtitle1" fontWeight={600}>
                        Resumen Ejecutivo
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Genera un resumen conciso de máximo 150 palabras con los puntos más relevantes para la toma de decisiones.
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Paper sx={{ p: 2, height: '100%' }}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <TrendingUp color="warning" />
                      <Typography variant="subtitle1" fontWeight={600}>
                        Evaluación de Riesgo
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Clasifica el nivel de riesgo del paciente (Alto/Medio/Bajo) y identifica factores de riesgo específicos.
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Paper sx={{ p: 2, height: '100%' }}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Analytics color="success" />
                      <Typography variant="subtitle1" fontWeight={600}>
                        Extracción de Datos
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Extrae información estructurada en formato JSON: edad, diagnósticos, medicamentos, signos vitales, etc.
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AnalysisPage;