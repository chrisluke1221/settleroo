import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Properties from './pages/Properties';
import PropertyDetail from './pages/PropertyDetail';
import Login from './pages/Login';
import TenantBillView from './pages/TenantBillView';
import { PropertyProvider } from './contexts/PropertyContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const RequireAuth = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <>
      <Helmet defer={false}>
        <meta name="robots" content="noindex" />
      </Helmet>
      {children}
    </>
  );
};

// An authenticated landlord lands on their work queue, not the marketing
// page — the marketing page is only for logged-out visitors.
const HomeOrDashboard = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Home />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeOrDashboard />} />
      <Route path="/login" element={<Login />} />
      <Route path="/bill/:token" element={<TenantBillView />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/properties"
        element={
          <RequireAuth>
            <Properties />
          </RequireAuth>
        }
      />
      <Route
        path="/properties/:propertyId"
        element={
          <RequireAuth>
            <PropertyDetail />
          </RequireAuth>
        }
      />
    </Routes>
  );
}

// The tenant bill link never gets the landlord's nav/account/logout chrome —
// anyone holding the link can open it, and TenantBillView renders its own
// standalone shell.
const AppShell = () => {
  const location = useLocation();
  const isTenantRoute = location.pathname.startsWith('/bill/');

  if (isTenantRoute) {
    return <AppRoutes />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-secondary-50">
      <Header />
      <main className="flex-1">
        <AppRoutes />
      </main>
      <Footer />
    </div>
  );
};

function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <PropertyProvider>
          <Router>
            <AppShell />
          </Router>
        </PropertyProvider>
      </AuthProvider>
    </HelmetProvider>
  );
}

export default App;
