import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { LanguageProvider } from '@/context/LanguageContext';
import ProtectedRoute from '@/components/ProtectedRoute';

// Landing page is the initial visit target — keep it in the main chunk so the
// first paint never waits on a second JS roundtrip.
import HomePage from '@/pages/HomePage';

const DashboardLayout = lazy(() => import('@/components/DashboardLayout'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const AcceptInvitationPage = lazy(() => import('@/pages/AcceptInvitationPage'));
const DashboardHome = lazy(() => import('@/pages/DashboardHome'));
const InventoryPage = lazy(() => import('@/pages/InventoryPage'));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'));
const EcommercePage = lazy(() => import('@/pages/EcommercePage'));
const InvoicesPage = lazy(() => import('@/pages/InvoicesPage'));
const ExpensesPage = lazy(() => import('@/pages/ExpensesPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const UserManagementPage = lazy(() => import('@/pages/UserManagementPage'));
const SurveillancePage = lazy(() => import('@/pages/SurveillancePage'));
const ClientsPage = lazy(() => import('@/pages/ClientsPage'));
const DistributorsPage = lazy(() => import('@/pages/DistributorsPage'));
const SubscriptionPage = lazy(() => import('@/pages/SubscriptionPage'));
const AdminPanelPage = lazy(() => import('@/pages/AdminPanelPage'));
const FeaturesPage = lazy(() => import('@/pages/FeaturesPage'));
const PricingPage = lazy(() => import('@/pages/PricingPage'));
const ContactPage = lazy(() => import('@/pages/ContactPage'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const TermsPage = lazy(() => import('@/pages/TermsPage'));
const NicheOnboardingPage = lazy(() => import('@/pages/NicheOnboardingPage'));
const BranchNicheOnboardingPage = lazy(() => import('@/pages/BranchNicheOnboardingPage'));

import { Toaster } from '@/components/ui/sonner';
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
            <Suspense fallback={null}>
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
            </Suspense>
            <Toaster richColors position="top-right" />
          </Router>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
