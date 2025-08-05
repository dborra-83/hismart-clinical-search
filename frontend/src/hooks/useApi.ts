import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import * as api from '../services/api';

// Hook para operaciones CRUD de notas
export const useNotes = (params?: Parameters<typeof api.getNotes>[0]) => {
  return useQuery(
    ['notes', params],
    () => api.getNotes(params),
    {
      staleTime: 5 * 60 * 1000, // 5 minutos
      cacheTime: 10 * 60 * 1000, // 10 minutos
    }
  );
};

export const useNote = (id: string) => {
  return useQuery(
    ['note', id],
    () => api.getNoteById(id),
    {
      enabled: !!id,
    }
  );
};

export const useCreateNote = () => {
  const queryClient = useQueryClient();
  
  return useMutation(api.createNote, {
    onSuccess: () => {
      queryClient.invalidateQueries(['notes']);
      queryClient.invalidateQueries(['dashboard-stats']);
    },
  });
};

export const useUpdateNote = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    ({ id, updates }: { id: string; updates: Parameters<typeof api.updateNote>[1] }) =>
      api.updateNote(id, updates),
    {
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries(['notes']);
        queryClient.invalidateQueries(['note', variables.id]);
      },
    }
  );
};

export const useDeleteNote = () => {
  const queryClient = useQueryClient();
  
  return useMutation(api.deleteNote, {
    onSuccess: () => {
      queryClient.invalidateQueries(['notes']);
      queryClient.invalidateQueries(['dashboard-stats']);
    },
  });
};

// Hook para búsquedas
export const useSearch = () => {
  return useMutation(api.searchNotes, {
    onSuccess: (data) => {
      console.log('Búsqueda completada:', data.total_encontrados, 'resultados');
    },
  });
};

// Hooks para análisis con IA
export const useAnalyzeNote = () => {
  return useMutation(api.analyzeNote, {
    onSuccess: (data) => {
      console.log('Análisis completado:', data.tipo_analisis);
    },
  });
};

export const useGenerateSummary = () => {
  return useMutation(api.generateSummary);
};

export const useAnalyzeRisk = () => {
  return useMutation(api.analyzeRisk);
};

export const useExtractData = () => {
  return useMutation(api.extractStructuredData);
};

// Hook para carga de archivos
export const useUpload = () => {
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  
  const getUploadUrlMutation = useMutation(api.getUploadUrl);
  
  const uploadFile = async (file: File, onProgress?: (progress: number) => void) => {
    try {
      // Obtener URL presignada
      const { data: urlData, error } = await api.apiRequest(() =>
        getUploadUrlMutation.mutateAsync({ filename: file.name })
      );
      
      if (error || !urlData) {
        throw new Error(error || 'Error obteniendo URL de carga');
      }
      
      // Subir archivo a S3
      const xhr = new XMLHttpRequest();
      
      return new Promise<string>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
            onProgress?.(progress);
          }
        });
        
        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
            resolve(urlData.file_key);
          } else {
            reject(new Error('Error subiendo archivo'));
          }
        });
        
        xhr.addEventListener('error', () => {
          reject(new Error('Error de red subiendo archivo'));
        });
        
        xhr.open('PUT', urlData.upload_url);
        xhr.setRequestHeader('Content-Type', 'text/csv');
        xhr.send(file);
      });
      
    } catch (error) {
      console.error('Error en upload:', error);
      throw error;
    }
  };
  
  return {
    uploadFile,
    uploadProgress,
    isUploading: getUploadUrlMutation.isLoading,
  };
};

// Hook para estadísticas del dashboard
export const useDashboardStats = () => {
  return useQuery(
    ['dashboard-stats'],
    api.getDashboardStats,
    {
      staleTime: 2 * 60 * 1000, // 2 minutos
      cacheTime: 5 * 60 * 1000, // 5 minutos
      refetchInterval: 5 * 60 * 1000, // Refrescar cada 5 minutos
    }
  );
};

// Hook personalizado para manejo de estado de carga
export const useAsyncOperation = <T, E = Error>(
  operation: () => Promise<T>
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<E | null>(null);
  
  const execute = async (...args: Parameters<typeof operation>) => {
    try {
      setLoading(true);
      setError(null);
      const result = await operation();
      setData(result);
      return result;
    } catch (err) {
      setError(err as E);
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  const reset = () => {
    setData(null);
    setError(null);
    setLoading(false);
  };
  
  return {
    data,
    loading,
    error,
    execute,
    reset,
  };
};

// Hook para debounce de búsquedas
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
};

// Hook para paginación
export const usePagination = (initialPage = 0, initialRowsPerPage = 10) => {
  const [page, setPage] = useState(initialPage);
  const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);
  
  const handlePageChange = (event: unknown, newPage: number) => {
    setPage(newPage);
  };
  
  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  const resetPagination = () => {
    setPage(0);
  };
  
  return {
    page,
    rowsPerPage,
    handlePageChange,
    handleRowsPerPageChange,
    resetPagination,
  };
};

// Hook para filtros de búsqueda
export const useSearchFilters = () => {
  const [filters, setFilters] = useState<{
    especialidad: string;
    medico: string;
    fechaDesde: Date | null;
    fechaHasta: Date | null;
  }>({
    especialidad: '',
    medico: '',
    fechaDesde: null,
    fechaHasta: null,
  });
  
  const updateFilter = <K extends keyof typeof filters>(
    key: K,
    value: typeof filters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };
  
  const clearFilters = () => {
    setFilters({
      especialidad: '',
      medico: '',
      fechaDesde: null,
      fechaHasta: null,
    });
  };
  
  const hasActiveFilters = Object.values(filters).some(value => 
    value !== '' && value !== null
  );
  
  return {
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
  };
};

// Hook para gestión de estado de análisis
export const useAnalysisState = () => {
  const [analysisHistory, setAnalysisHistory] = useState<api.AnalysisResult[]>([]);
  
  const addAnalysis = (result: api.AnalysisResult) => {
    setAnalysisHistory(prev => [result, ...prev.slice(0, 9)]); // Mantener últimos 10
  };
  
  const clearHistory = () => {
    setAnalysisHistory([]);
  };
  
  return {
    analysisHistory,
    addAnalysis,
    clearHistory,
  };
};