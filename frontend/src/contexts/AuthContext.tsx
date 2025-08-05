import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Auth } from 'aws-amplify';

interface User {
  username: string;
  email: string;
  name: string;
  groups: string[];
  especialidad?: string;
  hospital?: string;
  rol?: string;
  attributes: any;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUserAttributes: (attributes: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Función para extraer información del usuario desde los atributos de Cognito
  const parseUserFromCognitoUser = (cognitoUser: any): User => {
    const attributes = cognitoUser.attributes || {};
    const groups = cognitoUser.signInUserSession?.accessToken?.payload?.['cognito:groups'] || [];
    
    return {
      username: cognitoUser.username,
      email: attributes.email || '',
      name: attributes.name || attributes.given_name || '',
      groups: Array.isArray(groups) ? groups : [],
      especialidad: attributes['custom:especialidad'] || '',
      hospital: attributes['custom:hospital'] || '',
      rol: attributes['custom:rol'] || 'medico',
      attributes
    };
  };

  // Verificar si hay un usuario autenticado al cargar
  useEffect(() => {
    const checkAuthState = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const cognitoUser = await Auth.currentAuthenticatedUser();
        const userData = parseUserFromCognitoUser(cognitoUser);
        setUser(userData);
      } catch (err: any) {
        console.log('No hay usuario autenticado:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuthState();

    // Escuchar cambios en el estado de autenticación
    const hubListener = (data: any) => {
      const { payload } = data;
      
      switch (payload.event) {
        case 'signIn':
          console.log('Usuario autenticado');
          checkAuthState();
          break;
        case 'signOut':
          console.log('Usuario desautenticado');
          setUser(null);
          break;
        case 'signUp':
          console.log('Usuario registrado');
          break;
        case 'signIn_failure':
          console.log('Error de autenticación');
          setError('Error de autenticación');
          break;
        default:
          break;
      }
    };

    // Hub.listen sería usado aquí si importamos Hub de aws-amplify
    // Por ahora manejamos los estados manualmente

    return () => {
      // Cleanup si fuera necesario
    };
  }, []);

  const signIn = async (username: string, password: string) => {
    try {
      setLoading(true);
      setError(null);

      console.log('Intentando login con usuario:', username);
      
      const cognitoUser = await Auth.signIn(username, password);
      
      console.log('Respuesta de Cognito:', cognitoUser);
      
      // Manejar diferentes estados de autenticación
      if (cognitoUser.challengeName === 'NEW_PASSWORD_REQUIRED') {
        throw new Error('Se requiere cambio de contraseña. Contacte al administrador.');
      }
      
      if (cognitoUser.challengeName) {
        throw new Error(`Challenge no soportado: ${cognitoUser.challengeName}`);
      }

      const userData = parseUserFromCognitoUser(cognitoUser);
      setUser(userData);
    } catch (err: any) {
      console.error('Error en signIn:', err);
      
      let errorMessage = 'Error de autenticación';
      
      switch (err.code) {
        case 'UserNotFoundException':
          errorMessage = 'Usuario no encontrado';
          break;
        case 'NotAuthorizedException':
          errorMessage = 'Credenciales incorrectas';
          break;
        case 'UserNotConfirmedException':
          errorMessage = 'Usuario no confirmado. Contacte al administrador.';
          break;
        case 'PasswordResetRequiredException':
          errorMessage = 'Se requiere restablecer la contraseña';
          break;
        case 'TooManyRequestsException':
          errorMessage = 'Demasiados intentos. Intente más tarde.';
          break;
        default:
          errorMessage = err.message || 'Error de autenticación';
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await Auth.signOut();
      setUser(null);
      setError(null);
    } catch (err: any) {
      console.error('Error en signOut:', err);
      setError('Error al cerrar sesión');
    } finally {
      setLoading(false);
    }
  };

  const updateUserAttributes = async (attributes: any) => {
    try {
      if (!user) throw new Error('No hay usuario autenticado');
      
      setLoading(true);
      setError(null);
      
      const cognitoUser = await Auth.currentAuthenticatedUser();
      await Auth.updateUserAttributes(cognitoUser, attributes);
      
      // Recargar información del usuario
      const updatedCognitoUser = await Auth.currentAuthenticatedUser();
      const userData = parseUserFromCognitoUser(updatedCognitoUser);
      setUser(userData);
    } catch (err: any) {
      console.error('Error actualizando atributos:', err);
      setError('Error actualizando información del usuario');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    error,
    signIn,
    signOut,
    updateUserAttributes
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};