import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface BrandingColors {
  primario: string;
  secundario: string;
  fondo: string;
  texto: string;
  exito: string;
  error: string;
  advertencia: string;
  info: string;
}

interface BrandingTexts {
  login: string;
  descripcion: string;
  footer: string;
  titulo_busqueda: string;
  subtitulo_busqueda: string;
  boton_subir: string;
  boton_buscar: string;
  boton_analizar: string;
  placeholder_busqueda: string;
  loading: string;
  sin_resultados: string;
  error_carga: string;
  exito_carga: string;
}

interface BrandingConfig {
  idioma: string;
  formato_fecha: string;
  timezone: string;
}

interface Branding {
  nombre: string;
  logo: string;
  colores: BrandingColors;
  textos: BrandingTexts;
  configuracion: BrandingConfig;
}

interface BrandingContextType {
  branding: Branding | null;
  loading: boolean;
  error: string | null;
  updateBranding: (newBranding: Partial<Branding>) => void;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

interface BrandingProviderProps {
  children: ReactNode;
}

const defaultBranding: Branding = {
  nombre: "HISmart",
  logo: "/logo.svg",
  colores: {
    primario: "#0D47A1",
    secundario: "#1976D2",
    fondo: "#F4F6F8",
    texto: "#333333",
    exito: "#4CAF50",
    error: "#F44336",
    advertencia: "#FF9800",
    info: "#2196F3"
  },
  textos: {
    login: "Bienvenido a HISmart – Plataforma de búsqueda clínica inteligente",
    descripcion: "Sistema de gestión hospitalaria con búsqueda inteligente de notas clínicas",
    footer: "© 2024 HISmart. Todos los derechos reservados.",
    titulo_busqueda: "Búsqueda Inteligente de Notas Clínicas",
    subtitulo_busqueda: "Encuentra información clínica relevante con IA",
    boton_subir: "Subir Archivo CSV",
    boton_buscar: "Buscar",
    boton_analizar: "Analizar con IA",
    placeholder_busqueda: "Ingresa términos de búsqueda...",
    loading: "Procesando...",
    sin_resultados: "No se encontraron resultados",
    error_carga: "Error al cargar el archivo",
    exito_carga: "Archivo cargado exitosamente"
  },
  configuracion: {
    idioma: "es",
    formato_fecha: "DD/MM/YYYY",
    timezone: "America/Santiago"
  }
};

export const BrandingProvider: React.FC<BrandingProviderProps> = ({ children }) => {
  const [branding, setBranding] = useState<Branding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBranding = async () => {
      try {
        setLoading(true);
        setError(null);

        // Intentar cargar configuración de branding personalizada
        const response = await fetch('/branding/branding.json');
        
        if (response.ok) {
          const customBranding = await response.json();
          // Combinar branding por defecto con personalizado
          setBranding({
            ...defaultBranding,
            ...customBranding,
            colores: { ...defaultBranding.colores, ...customBranding.colores },
            textos: { ...defaultBranding.textos, ...customBranding.textos },
            configuracion: { ...defaultBranding.configuracion, ...customBranding.configuracion }
          });
        } else {
          // Usar branding por defecto si no se encuentra archivo personalizado
          setBranding(defaultBranding);
        }
      } catch (err) {
        // Usar branding por defecto silenciosamente
        setBranding(defaultBranding);
        setError(null);
      } finally {
        setLoading(false);
      }
    };

    loadBranding();
  }, []);

  const updateBranding = (newBranding: Partial<Branding>) => {
    setBranding(current => {
      if (!current) return current;
      
      return {
        ...current,
        ...newBranding,
        colores: { ...current.colores, ...newBranding.colores },
        textos: { ...current.textos, ...newBranding.textos },
        configuracion: { ...current.configuracion, ...newBranding.configuracion }
      };
    });
  };

  const value: BrandingContextType = {
    branding,
    loading,
    error,
    updateBranding
  };

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = (): BrandingContextType => {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error('useBranding debe ser usado dentro de un BrandingProvider');
  }
  return context;
};