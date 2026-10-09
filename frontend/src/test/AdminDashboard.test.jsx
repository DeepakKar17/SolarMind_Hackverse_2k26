import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { AuthContext } from '../context/AuthContext';
import { SolarProvider } from '../context/SolarContext';
import { ToastProvider } from '../components/common/Toast';
import AppRoutes from '../routes/AppRoutes';
import Sidebar from '../components/layout/Sidebar';
import authService from '../services/authService';

const renderAdminApp = (initialRoute = '/admin/dashboard', userRole = 'admin') => {
  const mockUser = {
    id: 'USR-ADMIN-01',
    email: 'admin@solarmind.io',
    full_name: 'Administrator SolarMind',
    role: userRole,
  };

  const authValue = {
    user: mockUser,
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    devLogin: vi.fn(),
    clearError: vi.fn(),
  };

  return render(
    <AuthContext.Provider value={authValue}>
      <SolarProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[initialRoute]}>
            <AppRoutes />
          </MemoryRouter>
        </ToastProvider>
      </SolarProvider>
    </AuthContext.Provider>
  );
};

const renderSidebarWithRole = (userRole = 'admin') => {
  const mockUser = {
    id: 'USR-TEST-01',
    email: 'test@solarmind.io',
    full_name: 'Test User',
    role: userRole,
  };

  const authValue = {
    user: mockUser,
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    devLogin: vi.fn(),
    clearError: vi.fn(),
  };

  return render(
    <AuthContext.Provider value={authValue}>
      <SolarProvider>
        <MemoryRouter>
          <Sidebar isOpen={true} onClose={vi.fn()} />
        </MemoryRouter>
      </SolarProvider>
    </AuthContext.Provider>
  );
};

describe('SolarMind Admin Dashboard & Governance Suite', () => {
  beforeEach(() => {
    sessionStorage.setItem(
      'solarmind_user_session',
      JSON.stringify({ id: 1, full_name: 'Solar Administrator', role: 'admin' })
    );
  });

  it('renders Admin Dashboard overview KPIs, health, and navigation for Admin role', async () => {
    renderAdminApp('/admin/dashboard', 'admin');

    await waitFor(() => {
      // Main Page Header
      expect(screen.getByText(/Enterprise Administration & Fleet Oversight/i)).toBeInTheDocument();
      expect(screen.getByText(/FastAPI Gateway & Database Readiness:/i)).toBeInTheDocument();

      // Stat Cards
      expect(screen.getAllByText(/User Accounts/i).length).toBeGreaterThan(0);
      expect(screen.getByText('Registered Fleet')).toBeInTheDocument();
      expect(screen.getByText('Telemetry Status')).toBeInTheDocument();
      expect(screen.getByText('Unresolved Diagnoses')).toBeInTheDocument();
      expect(screen.getByText('Open Work Orders')).toBeInTheDocument();
      expect(screen.getByText('Integration Health')).toBeInTheDocument();

      // Navigation Hub Links
      expect(screen.getByText('User Management')).toBeInTheDocument();
      expect(screen.getByText('Roles & Permissions')).toBeInTheDocument();
      expect(screen.getByText('Fault Catalog')).toBeInTheDocument();
      expect(screen.getByText('Diagnosis Rules Engine')).toBeInTheDocument();
      expect(screen.getAllByText(/Integrations Hub/i).length).toBeGreaterThan(0);
      expect(screen.getByText('Audit & Security Logs')).toBeInTheDocument();

      // Visualizations Titles
      expect(screen.getByText(/Fleet-Wide Generation vs Clear-Sky Target/i)).toBeInTheDocument();
      expect(screen.getByText(/Fault Category & Severity Breakdown/i)).toBeInTheDocument();
      expect(screen.getByText(/Work-Order Status Distribution/i)).toBeInTheDocument();
      expect(screen.getByText(/Plant Performance Comparison/i)).toBeInTheDocument();
      expect(screen.getByText(/Supported OpenAPI & Protocol Integrations/i)).toBeInTheDocument();
      expect(screen.getByText(/Recent Administrative & System Audit Events/i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('filters audit events trail by search keyword', async () => {
    renderAdminApp('/admin/dashboard', 'admin');

    await waitFor(() => {
      expect(screen.getByText('EVT-9041')).toBeInTheDocument();
    }, { timeout: 5000 });

    const searchInput = screen.getByPlaceholderText(/Search audit trail/i);
    fireEvent.change(searchInput, { target: { value: 'DEYE_CLOUD_SYNC' } });

    await waitFor(() => {
      expect(screen.getByText('EVT-9040')).toBeInTheDocument();
      expect(screen.queryByText('EVT-9041')).not.toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders dedicated administrative sub-pages for admin', async () => {
    const { unmount } = renderAdminApp('/admin/users', 'admin');
    await waitFor(() => {
      expect(screen.getByText('User Account & Role Assignments')).toBeInTheDocument();
      expect(screen.getByText('Registered Users Matrix')).toBeInTheDocument();
    }, { timeout: 5000 });
    unmount();

    const { unmount: unmountRoles } = renderAdminApp('/admin/roles', 'admin');
    await waitFor(() => {
      expect(screen.getByText('Role & Permission Policy Matrix')).toBeInTheDocument();
      expect(screen.getByText('RBAC Capability Matrix')).toBeInTheDocument();
    }, { timeout: 5000 });
    unmountRoles();

    const { unmount: unmountIntegrations } = renderAdminApp('/admin/integrations', 'admin');
    await waitFor(() => {
      expect(screen.getByText('Hardware OpenAPI & Integration Connectors')).toBeInTheDocument();
      expect(screen.getByText(/Deye Cloud Developer OpenAPI/i)).toBeInTheDocument();
    }, { timeout: 5000 });
    unmountIntegrations();

    const { unmount: unmountRules } = renderAdminApp('/admin/diagnosis-rules', 'admin');
    await waitFor(() => {
      expect(screen.getByText('Diagnosis Rules Configuration Engine')).toBeInTheDocument();
    }, { timeout: 5000 });
    unmountRules();

    const { unmount: unmountCatalog } = renderAdminApp('/admin/fault-catalog', 'admin');
    await waitFor(() => {
      expect(screen.getByText('Fault & Anomaly Catalog')).toBeInTheDocument();
    }, { timeout: 5000 });
    unmountCatalog();

    const { unmount: unmountAudit } = renderAdminApp('/admin/audit-logs', 'admin');
    await waitFor(() => {
      expect(screen.getByText('Audit & Security Event Trail')).toBeInTheDocument();
    }, { timeout: 5000 });
    unmountAudit();
  });

  it('strictly restricts /admin/dashboard and redirects Homeowners to /unauthorized', async () => {
    renderAdminApp('/admin/dashboard', 'homeowner');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Access Restricted/i })).toBeInTheDocument();
      expect(screen.queryByText(/Enterprise Administration & Fleet Oversight/i)).not.toBeInTheDocument();
    });
  });

  it('strictly restricts /admin/dashboard and redirects Technicians to /unauthorized', async () => {
    renderAdminApp('/admin/dashboard', 'technician');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Access Restricted/i })).toBeInTheDocument();
      expect(screen.queryByText(/Enterprise Administration & Fleet Oversight/i)).not.toBeInTheDocument();
    });
  });

  it('renders Administration navigation links in sidebar for Admin, but hides them for Homeowner and Technician', () => {
    // Admin Sidebar
    const { unmount: unmountAdmin } = renderSidebarWithRole('admin');
    expect(screen.getByText('Administration & Fleet Ops')).toBeInTheDocument();
    expect(screen.getByText('Admin Overview')).toBeInTheDocument();
    expect(screen.getByText('User Accounts')).toBeInTheDocument();
    expect(screen.getByText('Roles & Policies')).toBeInTheDocument();
    unmountAdmin();

    // Homeowner Sidebar
    const { unmount: unmountHomeowner } = renderSidebarWithRole('homeowner');
    expect(screen.queryByText('Administration & Fleet Ops')).not.toBeInTheDocument();
    expect(screen.queryByText('Admin Overview')).not.toBeInTheDocument();
    expect(screen.queryByText('User Accounts')).not.toBeInTheDocument();
    unmountHomeowner();

    // Technician Sidebar
    renderSidebarWithRole('technician');
    expect(screen.queryByText('Administration & Fleet Ops')).not.toBeInTheDocument();
    expect(screen.queryByText('Admin Overview')).not.toBeInTheDocument();
    expect(screen.queryByText('User Accounts')).not.toBeInTheDocument();
  });
});
