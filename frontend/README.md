# HISmart Frontend

Frontend React en español para HISmart - Sistema de búsqueda inteligente de notas clínicas.

## Tecnologías Utilizadas

- **React 18** con TypeScript
- **Material-UI (MUI)** para componentes de interfaz
- **AWS Amplify** para autenticación y integración con AWS
- **React Router** para navegación
- **React Query** para gestión de estado y cache
- **Recharts** para gráficos y visualizaciones
- **React Hook Form** para manejo de formularios
- **React Dropzone** para carga de archivos

## Estructura del Proyecto

```
frontend/
├── public/
│   ├── index.html
│   ├── manifest.json
│   └── branding/           # Assets de branding
├── src/
│   ├── components/
│   │   ├── common/         # Componentes reutilizables
│   │   └── layout/         # Componentes de layout
│   ├── contexts/           # Context providers
│   ├── hooks/              # Custom hooks
│   ├── pages/              # Páginas principales
│   ├── services/           # Servicios y API calls
│   ├── utils/              # Utilidades
│   ├── App.tsx
│   ├── index.tsx
│   ├── theme.ts            # Tema Material-UI
│   └── aws-config.ts       # Configuración AWS
├── package.json
└── README.md
```

## Características Principales

### 🔐 Autenticación
- Login con Amazon Cognito
- Autenticación multifactor (MFA)
- Gestión de roles y permisos
- Sesión segura con JWT tokens

### 📊 Dashboard
- Métricas en tiempo real
- Gráficos interactivos
- Acciones rápidas
- Información de usuario

### 🔍 Búsqueda Inteligente
- Búsqueda de texto completo
- Filtros avanzados por especialidad, médico, fecha
- Resultados con puntuación de relevancia
- Preview de contenido

### 📤 Carga de Archivos
- Drag & drop para archivos CSV
- Progreso de carga en tiempo real
- Validación de formato
- Estado de procesamiento

### 📝 Gestión de Notas
- Lista paginada de notas clínicas
- Visualización detallada
- Filtros y búsqueda
- Exportación de datos

### 🤖 Análisis con IA
- Integración con Amazon Bedrock (Claude)
- Múltiples tipos de análisis:
  - Análisis completo
  - Resumen ejecutivo
  - Evaluación de riesgos
  - Extracción de datos estructurados

### 🎨 Branding Personalizable
- Colores corporativos editables
- Logo personalizable
- Textos configurables
- Tema responsive

### ⚙️ Configuración
- Perfil de usuario
- Configuración de seguridad
- Personalización de marca
- Preferencias de notificaciones

## Instalación y Desarrollo

### Prerrequisitos
- Node.js 18+
- npm o yarn

### Configuración Inicial

1. **Instalar dependencias:**
```bash
npm install
```

2. **Configurar variables de entorno:**
Crear archivo `.env` en la raíz:
```bash
REACT_APP_AWS_REGION=us-east-1
REACT_APP_USER_POOL_ID=us-east-1_xxxxxxxxx
REACT_APP_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
REACT_APP_IDENTITY_POOL_ID=us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
REACT_APP_API_URL=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod
REACT_APP_S3_BUCKET=hismart-clinical-data-bucket
```

3. **Configurar branding (opcional):**
Editar `/public/branding/branding.json`:
```json
{
  "nombre": "HISmart Hospital XYZ",
  "logo": "/branding/logo.png",
  "colores": {
    "primario": "#1565C0",
    "secundario": "#42A5F5"
  }
}
```

### Scripts Disponibles

```bash
# Desarrollo
npm start                 # Inicia servidor de desarrollo en http://localhost:3000

# Construcción
npm run build            # Construye para producción en /build

# Testing
npm test                 # Ejecuta tests unitarios

# Despliegue
npm run deploy           # Construye y despliega a S3
```

## Configuración AWS

### Amplify Configuration
El archivo `aws-config.ts` configura automáticamente Amplify usando:
1. Variables de entorno (desarrollo)
2. Archivo `aws-config.json` generado por CDK (producción)

### Cognito Setup
- **User Pool:** Gestión de usuarios médicos
- **Identity Pool:** Acceso federado a recursos AWS
- **Grupos:** Administradores, Médicos, Enfermería

### API Integration
- **REST API:** AWS API Gateway + Lambda
- **Autenticación:** JWT tokens de Cognito
- **CORS:** Configurado para dominios específicos

## Componentes Principales

### BrandingContext
```typescript
const { branding, updateBranding } = useBranding();
// Acceso a configuración de marca en cualquier componente
```

### AuthContext
```typescript
const { user, signIn, signOut } = useAuth();
// Gestión de autenticación global
```

### Layout Component
- Navegación lateral responsiva
- Header con información de usuario
- Menú contextual
- Rutas protegidas

### LoadingSpinner
- Spinner reutilizable
- Mensaje personalizable
- Modo pantalla completa o inline

### ErrorBoundary
- Captura errores de React
- Interfaz amigable de error
- Información de debug en desarrollo

## Páginas

### 🏠 Dashboard (`/dashboard`)
- Métricas generales del sistema
- Gráficos de notas por especialidad
- Top médicos más activos
- Acciones rápidas

### 🔍 Search (`/search`)
- Búsqueda con filtros avanzados
- Resultados con relevancia
- Preview de notas
- Análisis directo

### 📤 Upload (`/upload`)
- Carga de archivos CSV
- Zona drag & drop
- Progreso en tiempo real
- Validación de formato

### 📝 Notes (`/notes`)
- Lista de todas las notas
- Tabla paginada y filtrable
- Vista detallada en modal
- Acciones de análisis

### 🤖 Analysis (`/analysis`)
- 4 tipos de análisis con IA
- Editor de texto integrado
- Resultados formateados
- Ejemplos predefinidos

### ⚙️ Settings (`/settings`)
- Perfil de usuario
- Configuración de seguridad
- Personalización de branding
- Preferencias de notificaciones

## Responsive Design

- **Mobile First:** Diseño optimizado para móviles
- **Breakpoints MUI:** xs, sm, md, lg, xl
- **Layout Adaptivo:** Sidebar colapsable en móvil
- **Componentes Flexibles:** Grids y cards responsivos

## Internacionalización

- **Idioma:** Español por defecto
- **Fechas:** Formato DD/MM/YYYY
- **Números:** Separador de miles y decimales localizados
- **Textos:** Configurables vía branding.json

## Seguridad

### Implementaciones de Seguridad
- ✅ Autenticación JWT con Cognito
- ✅ Rutas protegidas con guards
- ✅ Roles y permisos granulares
- ✅ Sanitización de inputs
- ✅ HTTPS obligatorio
- ✅ CSP headers configurados
- ✅ No exposición de tokens en logs

### Buenas Prácticas
- Tokens almacenados seguramente
- Refresh automático de sesión
- Logout automático por inactividad
- Validación de permisos por ruta

## Testing

### Tests Unitarios
```bash
npm test
```

### Tests de Integración
- Flujos de autenticación
- Carga de archivos
- Búsquedas
- Análisis con IA

## Despliegue

### S3 + CloudFront
```bash
# Construcción y despliegue
npm run build
aws s3 sync build/ s3://bucket-name --delete
aws cloudfront create-invalidation --distribution-id XXXX --paths "/*"
```

### Variables de Entorno por Ambiente
- **Desarrollo:** `.env.development`
- **Staging:** `.env.staging`  
- **Producción:** `.env.production`

## Personalización

### Branding Corporativo
1. Editar `/public/branding/branding.json`
2. Agregar logo en `/public/branding/logo.png`
3. Personalizar colores y textos
4. Reconstruir aplicación

### Temas Personalizados
```typescript
// theme.ts
const customTheme = createTheme({
  palette: {
    primary: { main: '#YourColor' },
    // ...
  }
});
```

## Troubleshooting

### Error: "Module not found"
```bash
rm -rf node_modules package-lock.json
npm install
```

### Error: "AWS configuration"
Verificar variables de entorno y archivo `aws-config.json`

### Error: "CORS"
Verificar configuración de API Gateway y dominios permitidos

### Error de memoria en build
```bash
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

## Performance

### Optimizaciones Implementadas
- Code splitting por rutas
- Lazy loading de componentes
- Memoización con React.memo
- Imágenes optimizadas
- Bundle analysis

### Métricas de Performance
- First Contentful Paint < 2s
- Largest Contentful Paint < 4s
- Bundle size < 1MB gzipped

## Contribución

### Estructura de Commits
```
feat: nueva funcionalidad
fix: corrección de bug
docs: actualización de documentación
style: cambios de formato
refactor: refactorización de código
test: adición de tests
```

### Pull Requests
1. Fork del repositorio
2. Crear branch feature/fix
3. Implementar cambios
4. Agregar tests
5. Actualizar documentación
6. Crear PR con descripción detallada

---

Para más información técnica, consultar los comentarios en el código de cada componente.