import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import AuthLayout from '../layouts/AuthLayout';
import { LoadingState } from '../components/common';
import { ProtectedRoute, RoleGuard } from '../components/auth';
import RoleHomeRedirect from '../components/auth/RoleHomeRedirect';

// Lazy-loaded main application pages
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const HomeownerDashboardPage = lazy(() => import('../pages/HomeownerDashboardPage'));
const PlantsPage = lazy(() => import('../pages/PlantsPage'));
const PlantDetailPage = lazy(() => import('../pages/PlantDetailPage'));
const InvertersPage = lazy(() => import('../pages/InvertersPage'));
const InverterDetailPage = lazy(() => import('../pages/InverterDetailPage'));
const MonitoringPage = lazy(() => import('../pages/MonitoringPage'));
const DiagnosisPage = lazy(() => import('../pages/DiagnosisPage'));
const DiagnosisDetailPage = lazy(() => import('../pages/DiagnosisDetailPage'));
const GeoPhotoPage = lazy(() => import('../pages/GeoPhotoPage'));
const AnalyticsPage = lazy(() => import('../pages/AnalyticsPage'));
const WorkOrdersPage = lazy(() => import('../pages/WorkOrdersPage'));
const WorkOrderDetailPage = lazy(() => import('../pages/WorkOrderDetailPage'));
const MaintenancePage = lazy(() => import('../pages/MaintenancePage'));
const TechnicianDashboardPage = lazy(() => import('../pages/TechnicianDashboardPage'));
const AlertsPage = lazy(() => import('../pages/AlertsPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const DesignSystemPage = lazy(() => import('../pages/DesignSystemPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

// Lazy-loaded administrative pages
const AdminDashboardPage = lazy(() => import('../pages/admin/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('../pages/admin/AdminUsersPage'));
const AdminRolesPage = lazy(() => import('../pages/admin/AdminRolesPage'));
const AdminFaultCatalogPage = lazy(() => import('../pages/admin/AdminFaultCatalogPage'));
const AdminDiagnosisRulesPage = lazy(() => import('../pages/admin/AdminDiagnosisRulesPage'));
const AdminIntegrationsPage = lazy(() => import('../pages/admin/AdminIntegrationsPage'));
const AdminAuditLogsPage = lazy(() => import('../pages/admin/AdminAuditLogsPage'));

// Lazy-loaded authentication pages
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('../pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('../pages/auth/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('../pages/auth/VerifyEmailPage'));
const UnauthorizedPage = lazy(() => import('../pages/auth/UnauthorizedPage'));

export const AppRoutes = () => {
  return (
    <Suspense fallback={<LoadingState message="Loading SolarMind workspace..." />}>
      <Routes>
        {/* Authentication Flow Routes with AuthLayout */}
        <Route element={<AuthLayout />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route path="verify-email" element={<VerifyEmailPage />} />
          <Route path="unauthorized" element={<UnauthorizedPage />} />
        </Route>

        {/* Protected Dashboard Workspace Routes with MainLayout */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<MainLayout />}>
            {/* Role-Aware Default Route Redirect */}
            <Route index element={<RoleHomeRedirect />} />

            {/* Core Authenticated Workspace Routes */}
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="home/dashboard" element={<HomeownerDashboardPage />} />
            <Route path="plants" element={<PlantsPage />} />
            <Route path="plants/:plantId" element={<PlantDetailPage />} />
            <Route path="inverters" element={<InvertersPage />} />
            <Route path="inverters/:inverterId" element={<InverterDetailPage />} />
            <Route path="monitoring" element={<MonitoringPage />} />
            <Route path="diagnosis" element={<DiagnosisPage />} />
            <Route path="diagnostics" element={<Navigate to="/diagnosis" replace />} />
            <Route path="diagnosis/:diagnosisId" element={<DiagnosisDetailPage />} />
            <Route path="geo-photo" element={<GeoPhotoPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="work-orders" element={<WorkOrdersPage />} />
            <Route path="work-orders/:workOrderId" element={<WorkOrderDetailPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="settings" element={<SettingsPage />} />

            {/* Operations & Maintenance - Restricted to Admin, Technician, Operator */}
            <Route element={<RoleGuard allowedRoles={['admin', 'technician', 'operator']} />}>
              <Route path="technician/dashboard" element={<TechnicianDashboardPage />} />
              <Route path="maintenance" element={<MaintenancePage />} />
            </Route>

            {/* Administrator Only Routes - Strictly Restricted to Admin Role */}
            <Route element={<RoleGuard allowedRoles={['admin']} />}>
              <Route path="admin/dashboard" element={<AdminDashboardPage />} />
              <Route path="admin/users" element={<AdminUsersPage />} />
              <Route path="admin/roles" element={<AdminRolesPage />} />
              <Route path="admin/fault-catalog" element={<AdminFaultCatalogPage />} />
              <Route path="admin/diagnosis-rules" element={<AdminDiagnosisRulesPage />} />
              <Route path="admin/integrations" element={<AdminIntegrationsPage />} />
              <Route path="admin/audit-logs" element={<AdminAuditLogsPage />} />
            </Route>

            {/* Design System Reference */}
            <Route path="design-system" element={<DesignSystemPage />} />

            {/* Catch-all 404 Route */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
