import { API, Auth } from 'aws-amplify';

// Configuración de la API
const API_NAME = 'HiSmartAPI';

// Tipos de datos
export interface ClinicalNote {
  id: string;
  paciente_id: string;
  fecha_nota: string;
  medico: string;
  especialidad: string;
  tipo_nota: string;
  diagnosticos: string[];
  medicamentos: string[];
  contenido_original: string;
  contenido_procesado?: string;
  palabras_clave?: string[];
  resumen_ia?: string;
  analisis_ia_completo?: string;
  analisis_riesgo?: string;
  estado: string;
  fecha_carga: string;
  usuario_creacion?: string;
}

export interface SearchParams {
  query: string;
  filtros?: {
    especialidad?: string;
    medico?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
  };
  limit?: number;
  include_content?: boolean;
}

export interface SearchResult {
  query: string;
  resultados: Array<ClinicalNote & { relevance_score: number }>;
  total_encontrados: number;
  tiempo_busqueda: number;
}

export interface AnalysisRequest {
  note_id?: string;
  contenido?: string;
  tipo_analisis: 'completo' | 'resumen' | 'riesgo' | 'extraccion';
  max_palabras?: number;
  factores_adicionales?: string[];
}

export interface AnalysisResult {
  tipo_analisis: string;
  contenido_analizado?: string;
  analisis: string;
  timestamp: string;
  usuario: string;
}

export interface UploadUrlRequest {
  filename: string;
}

export interface UploadUrlResponse {
  upload_url: string;
  file_key: string;
  expires_in: number;
}

export interface DashboardStats {
  total_notas: number;
  notas_por_especialidad: Record<string, number>;
  notas_por_medico: Record<string, number>;
  notas_por_mes: Record<string, number>;
  estados: Record<string, number>;
}

// Servicios de API

/**
 * Obtiene el token de autenticación actual
 */
const getAuthToken = async (): Promise<string> => {
  try {
    const session = await Auth.currentSession();
    return session.getIdToken().getJwtToken();
  } catch (error) {
    throw new Error('No se pudo obtener el token de autenticación');
  }
};

/**
 * Configuración base para requests
 */
const getRequestConfig = async () => {
  const token = await getAuthToken();
  return {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
};

// CRUD de Notas Clínicas

/**
 * Obtiene una lista de notas clínicas con filtros opcionales
 */
export const getNotes = async (params?: {
  paciente_id?: string;
  medico?: string;
  especialidad?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  limit?: number;
  last_key?: string;
}): Promise<{
  notas: ClinicalNote[];
  total: number;
  last_key?: string;
}> => {
  const config = await getRequestConfig();
  
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, value.toString());
    });
  }
  
  const path = `/notes${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  
  return await API.get(API_NAME, path, config);
};

/**
 * Obtiene una nota específica por ID
 */
export const getNoteById = async (id: string): Promise<{ nota: ClinicalNote }> => {
  const config = await getRequestConfig();
  return await API.get(API_NAME, `/notes/${id}`, config);
};

/**
 * Crea una nueva nota clínica
 */
export const createNote = async (noteData: {
  paciente_id: string;
  contenido: string;
  diagnosticos?: string[];
  medicamentos?: string[];
  tipo_nota?: string;
}): Promise<{ message: string; nota: ClinicalNote }> => {
  const config = await getRequestConfig();
  
  return await API.post(API_NAME, '/notes', {
    body: noteData,
    ...config
  });
};

/**
 * Actualiza una nota existente
 */
export const updateNote = async (id: string, updates: {
  contenido?: string;
  diagnosticos?: string[];
  medicamentos?: string[];
  tipo_nota?: string;
}): Promise<{ message: string; nota: ClinicalNote }> => {
  const config = await getRequestConfig();
  
  return await API.put(API_NAME, `/notes/${id}`, {
    body: updates,
    ...config
  });
};

/**
 * Elimina una nota (solo admin)
 */
export const deleteNote = async (id: string): Promise<{ message: string }> => {
  const config = await getRequestConfig();
  return await API.del(API_NAME, `/notes/${id}`, config);
};

// Búsquedas

/**
 * Realiza búsqueda avanzada de notas clínicas
 */
export const searchNotes = async (searchParams: SearchParams): Promise<SearchResult> => {
  const config = await getRequestConfig();
  
  return await API.post(API_NAME, '/search', {
    body: searchParams,
    ...config
  });
};

// Análisis con IA

/**
 * Analiza una nota clínica con IA
 */
export const analyzeNote = async (request: AnalysisRequest): Promise<AnalysisResult> => {
  const config = await getRequestConfig();
  
  return await API.post(API_NAME, '/analyze/note', {
    body: request,
    ...config
  });
};

/**
 * Genera resumen ejecutivo
 */
export const generateSummary = async (request: {
  contenido: string;
  max_palabras?: number;
}): Promise<{
  resumen: string;
  palabras_objetivo: number;
  contenido_original_chars: number;
  timestamp: string;
}> => {
  const config = await getRequestConfig();
  
  return await API.post(API_NAME, '/analyze/summary', {
    body: request,
    ...config
  });
};

/**
 * Evalúa riesgo del paciente
 */
export const analyzeRisk = async (request: {
  contenido: string;
  factores_adicionales?: string[];
}): Promise<{
  nivel_riesgo: string;
  analisis_completo: string;
  factores_considerados: string[];
  timestamp: string;
  evaluado_por: string;
}> => {
  const config = await getRequestConfig();
  
  return await API.post(API_NAME, '/analyze/risk', {
    body: request,
    ...config
  });
};

/**
 * Extrae datos estructurados
 */
export const extractStructuredData = async (request: {
  contenido: string;
}): Promise<{
  datos_estructurados: any;
  contenido_chars: number;
  timestamp: string;
}> => {
  const config = await getRequestConfig();
  
  return await API.post(API_NAME, '/analyze/extract', {
    body: request,
    ...config
  });
};

// Carga de archivos

/**
 * Genera URL presignada para subir archivo CSV
 */
export const getUploadUrl = async (request: UploadUrlRequest): Promise<UploadUrlResponse> => {
  const config = await getRequestConfig();
  
  return await API.post(API_NAME, '/upload/csv', {
    body: request,
    ...config
  });
};

/**
 * Obtiene el estado de procesamiento de un archivo
 */
export const getUploadStatus = async (jobId: string): Promise<{
  status: string;
  processed?: number;
  errors?: number;
  details?: any;
}> => {
  const config = await getRequestConfig();
  return await API.get(API_NAME, `/upload/status/${jobId}`, config);
};

// Estadísticas

/**
 * Obtiene estadísticas para el dashboard
 */
export const getDashboardStats = async (): Promise<{ estadisticas: DashboardStats }> => {
  const config = await getRequestConfig();
  return await API.get(API_NAME, '/stats/dashboard', config);
};

// Utilidades

/**
 * Maneja errores de API de forma consistente
 */
export const handleApiError = (error: any): string => {
  console.error('API Error:', error);
  
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  switch (error.response?.status) {
    case 400:
      return 'Solicitud inválida. Verifica los datos enviados.';
    case 401:
      return 'No autorizado. Por favor, inicia sesión nuevamente.';
    case 403:
      return 'No tienes permisos para realizar esta acción.';
    case 404:
      return 'Recurso no encontrado.';
    case 429:
      return 'Demasiadas solicitudes. Intenta más tarde.';
    case 500:
      return 'Error del servidor. Intenta más tarde.';
    default:
      return error.message || 'Error de conexión. Verifica tu conexión a internet.';
  }
};

/**
 * Wrapper para requests con manejo de errores
 */
export const apiRequest = async <T>(
  requestFn: () => Promise<T>
): Promise<{ data?: T; error?: string }> => {
  try {
    const data = await requestFn();
    return { data };
  } catch (error) {
    return { error: handleApiError(error) };
  }
};