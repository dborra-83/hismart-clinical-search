import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';

import { useAuth } from './contexts/AuthContext';
import { useBranding } from './contexts/BrandingContext';

// Components
import LoadingSpinner from './components/common/LoadingSpinner';
import ErrorBoundary from './components/common/ErrorBoundary';
import Layout from './components/layout/Layout';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SearchPage from './pages/SearchPage';
import UploadPage from './pages/UploadPage';
import NotesPage from './pages/NotesPage';
import AnalysisPage from './pages/AnalysisPage';
import SettingsPage from './pages/SettingsPage';

function App() {
  const { user, loading } = useAuth();
  const { branding, loading: brandingLoading } = useBranding();

  if (loading || brandingLoading) {
    return <LoadingSpinner />;
  }

  return (
    <ErrorBoundary>
      <Box 
        sx={{ 
          minHeight: '100vh',
          bgcolor: branding?.colores?.fondo || '#F4F6F8'
        }}
      >
        {!user ? (
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        ) : (
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/notes" element={<NotesPage />} />
              <Route path="/notes/:id" element={<NotesPage />} />
              <Route path="/analysis" element={<AnalysisPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/login" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Layout>
        )}
      </Box>
    </ErrorBoundary>
  );
}

export default App;