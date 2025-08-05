import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Amplify } from 'aws-amplify';

import App from './App';
import { BrandingProvider } from './contexts/BrandingContext';
import { AuthProvider } from './contexts/AuthContext';
import theme from './theme';

// Configurar AWS Amplify directamente con valores
Amplify.configure({
  Auth: {
    region: 'us-east-1',
    userPoolId: 'us-east-1_m8sYNBNrl',
    userPoolWebClientId: '2jo6jlihm9jao8vn79c7hasp73',
    mandatorySignIn: true,
    authenticationFlowType: 'USER_PASSWORD_AUTH'
  },
  API: {
    endpoints: [
      {
        name: 'HiSmartAPI',
        endpoint: 'https://jcbisv3pj8.execute-api.us-east-1.amazonaws.com/prod',
        region: 'us-east-1',
        custom_header: async () => {
          return { 
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization'
          }
        }
      }
    ]
  }
});

// Crear cliente de React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <QueryClientProvider client={queryClient}>
        <BrandingProvider>
          <AuthProvider>
            <ThemeProvider theme={theme}>
              <CssBaseline />
              <App />
            </ThemeProvider>
          </AuthProvider>
        </BrandingProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);