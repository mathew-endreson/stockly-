import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { LanguageProvider } from '@/context/LanguageContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/DashboardLayout';

// Pages
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import AcceptInvitationPage from '@/pages/AcceptInvitationPage';
import DashboardHome from '@/pages/DashboardHome';
import InventoryPage from '@/pages/InventoryPage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import EcommercePage from '@/pages/EcommercePage';
import InvoicesPage from '@/pages/InvoicesPage';
import ExpensesPage from '@/pages/ExpensesPage';
import SettingsPage from '@/pages/SettingsPage';
import UserManagementPage from '@/pages/UserManagementPage';
import SurveillancePage from '@/pages/SurveillancePage';
import ClientsPage from '@/pages/ClientsPage';
import DistributorsPage from '@/pages/DistributorsPage';
import SubscriptionPage from '@/pages/SubscriptionPage';
import AdminPanelPage from '@/pages/AdminPanelPage';
import HomePage from '@/pages/HomePage';
import FeaturesPage from '@/pages/FeaturesPage';
import PricingPage from '@/pages/PricingPage';
import ContactPage from '@/pages/ContactPage';
import PrivacyPage from '@/pages/PrivacyPage';
import TermsPage from '@/pages/TermsPage';
import { Toaster } from '@/components/ui/sonner';
import NicheOnboardingPage from '@/pages/NicheOnboardingPage';
import BranchNicheOnboardingPage from '@/pages/BranchNicheOnboardingPage';
import { isDesktopRuntime } from '@/shared/platform/platform';
import { startDesktopSyncLifecycle } from '@/shared/sync/syncLifecycle';
import { adminAPI } from '@/services/api';

import './App.css';

const DesktopEntryRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;

  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />;
};

function App() {
  const isDesktop = isDesktopRuntime();

  React.useEffect(() => {
    if (!isDesktop) return;
    return startDesktopSyncLifecycle();
  }, [isDesktop]);

  React.useEffect(() => {
    if (isDesktop || typeof window === 'undefined') return;
    if (sessionStorage.getItem('stockly:visit-tracked') === 'true') return;

    const visitorKey = 'stockly:visitor-id';
    let visitorId = localStorage.getItem(visitorKey);
    if (!visitorId) {
      visitorId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `visitor_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(visitorKey, visitorId);
    }

    sessionStorage.setItem('stockly:visit-tracked', 'true');
    void adminAPI.trackVisit({
      visitorId,
      path: `${window.location.pathname}${window.location.search}`,
      referrer: document.referrer,
    });
  }, [isDesktop]);

  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <Router>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={isDesktop ? <DesktopEntryRoute /> : <HomePage />} />
              <Route path="/features" element={isDesktop ? <DesktopEntryRoute /> : <FeaturesPage />} />
              <Route path="/pricing" element={isDesktop ? <DesktopEntryRoute /> : <PricingPage />} />
              <Route path="/contact" element={isDesktop ? <DesktopEntryRoute /> : <ContactPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
              <Route path="/subscribe" element={<SubscriptionPage />} />

              {/* Protected Dashboard Routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute requireSubscription={true}>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardHome />} />
                <Route path="inventory" element={<InventoryPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="ecommerce" element={<EcommercePage />} />
                <Route path="business-tools" element={<Navigate to="/dashboard" replace />} />
                <Route path="invoices" element={<InvoicesPage />} />
                <Route path="expenses" element={<ExpensesPage />} />
                <Route path="clients" element={<ClientsPage />} />
                <Route path="distributors" element={<DistributorsPage />} />
                <Route path="users" element={<UserManagementPage />} />
                <Route path="surveillance" element={<SurveillancePage />} />
                <Route path="admin" element={<AdminPanelPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              {/* Niche onboarding — auth required, no subscription gate */}
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute requireSubscription={false}>
                    <NicheOnboardingPage />
                  </ProtectedRoute>
                }
              />

              {/* Branch stock niche onboarding */}
              <Route
                path="/branch-onboarding/:stockId"
                element={
                  <ProtectedRoute requireSubscription={false}>
                    <BranchNicheOnboardingPage />
                  </ProtectedRoute>
                }
              />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Toaster richColors position="top-right" />
          </Router>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
