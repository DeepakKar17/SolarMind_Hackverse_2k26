import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ProtectedRoute, RoleGuard } from '../components/auth';
import RoleHomeRedirect from '../components/auth/RoleHomeRedirect';
import authService from '../services/authService';
import homeownerService from '../services/homeownerService';
import technicianService from '../services/technicianService';
import weatherService from '../services/weatherService';
import apiClient, { setAuthToken, getAuthToken } from '../services/api';

// Dummy test components
const AdminView = () => <div data-testid="admin-view">Admin Operations Hub</div>;
const TechView = () => <div data-testid="tech-view">Technician Dispatch Field App</div>;
const HomeView = () => <div data-testid="home-view">Homeowner Solar Portal</div>;
const GeneralView = () => <div data-testid="general-view">General Fleet Dashboard</div>;
const UnauthorizedView = () => <div data-testid="unauthorized-view">403 Access Denied</div>;
const LoginView = () => <div data-testid="login-view">Sign In</div>;

const TestRouter = ({ initialEntries = ['/'] }) => (
  <AuthProvider>
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/login" element={<LoginView />} />
        <Route path="/unauthorized" element={<UnauthorizedView />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<RoleHomeRedirect />} />
          <Route path="/dashboard" element={<GeneralView />} />
          <Route path="/home/dashboard" element={<HomeView />} />
          <Route element={<RoleGuard allowedRoles={['technician', 'admin']} />}>
            <Route path="/technician/dashboard" element={<TechView />} />
          </Route>
          <Route element={<RoleGuard allowedRoles={['admin']} />}>
            <Route path="/admin/dashboard" element={<AdminView />} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>
  </AuthProvider>
);

describe('Role-Aware Frontend/Backend Integration & Journey Testing', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    authService.resetSession();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Admin Journey: Routes to General/Admin dashboard and permits admin-scoped routes', async () => {
    sessionStorage.setItem(
      'solarmind_user_session',
      JSON.stringify({
        id: 1,
        email: 'admin@solarmind.ai',
        full_name: 'Administrator',
        role: 'ADMIN',
        is_active: true,
      })
    );
    setAuthToken('mock-admin-bearer-token');

    render(<TestRouter initialEntries={['/admin/dashboard']} />);

    await waitFor(() => {
      expect(screen.getByTestId('admin-view')).toBeInTheDocument();
    });
  });

  it('2. Technician Journey: Dynamically routes index to /technician/dashboard', async () => {
    sessionStorage.setItem(
      'solarmind_user_session',
      JSON.stringify({
        id: 2,
        email: 'tech.ramesh@solarmind.ai',
        full_name: 'Ramesh Kumar',
        role: 'TECHNICIAN',
        is_active: true,
      })
    );
    setAuthToken('mock-tech-bearer-token');

    render(<TestRouter initialEntries={['/']} />);

    await waitFor(() => {
      expect(screen.getByTestId('tech-view')).toBeInTheDocument();
    });
  });

  it('3. Technician Access Guard: Denies access to /admin/dashboard and redirects to /unauthorized', async () => {
    sessionStorage.setItem(
      'solarmind_user_session',
      JSON.stringify({
        id: 2,
        email: 'tech.ramesh@solarmind.ai',
        full_name: 'Ramesh Kumar',
        role: 'TECHNICIAN',
        is_active: true,
      })
    );
    setAuthToken('mock-tech-bearer-token');

    render(<TestRouter initialEntries={['/admin/dashboard']} />);

    await waitFor(() => {
      expect(screen.getByTestId('unauthorized-view')).toBeInTheDocument();
      expect(screen.queryByTestId('admin-view')).not.toBeInTheDocument();
    });
  });

  it('4. Homeowner Journey: Dynamically routes index to /home/dashboard', async () => {
    sessionStorage.setItem(
      'solarmind_user_session',
      JSON.stringify({
        id: 3,
        email: 'homeowner.debashis@gmail.com',
        full_name: 'Debashis Mohanty',
        role: 'HOMEOWNER',
        is_active: true,
      })
    );
    setAuthToken('mock-home-bearer-token');

    render(<TestRouter initialEntries={['/']} />);

    await waitFor(() => {
      expect(screen.getByTestId('home-view')).toBeInTheDocument();
    });
  });

  it('5. Homeowner Access Guard: Denies technician & admin routes and redirects to /unauthorized', async () => {
    sessionStorage.setItem(
      'solarmind_user_session',
      JSON.stringify({
        id: 3,
        email: 'homeowner.debashis@gmail.com',
        full_name: 'Debashis Mohanty',
        role: 'HOMEOWNER',
        is_active: true,
      })
    );
    setAuthToken('mock-home-bearer-token');

    render(<TestRouter initialEntries={['/technician/dashboard']} />);

    await waitFor(() => {
      expect(screen.getByTestId('unauthorized-view')).toBeInTheDocument();
      expect(screen.queryByTestId('tech-view')).not.toBeInTheDocument();
    });
  });

  it('6. Unauthenticated Guard: Redirects anonymous requests to /login', async () => {
    render(<TestRouter initialEntries={['/dashboard']} />);

    await waitFor(() => {
      expect(screen.getByTestId('login-view')).toBeInTheDocument();
    });
  });

  it('7. Session Token Injection & Expiry: Interceptor handles 401 and clears tokens', async () => {
    setAuthToken('valid-session-jwt-token');
    expect(getAuthToken()).toBe('valid-session-jwt-token');

    const authExpiredListener = vi.fn();
    window.addEventListener('solarmind_auth_expired', authExpiredListener);

    try {
      await apiClient.interceptors.response.handlers[0].rejected({
        response: { status: 401, data: { detail: 'Token expired or revoked' } },
      });
    } catch (err) {
      expect(err.isAuthError).toBe(true);
      expect(err.status).toBe(401);
      expect(getAuthToken()).toBeNull();
      expect(authExpiredListener).toHaveBeenCalled();
    }

    window.removeEventListener('solarmind_auth_expired', authExpiredListener);
  });

  it('8. Service Layer Contract: Confirms homeowner, technician, and weather services', () => {
    expect(typeof homeownerService.getDashboard).toBe('function');
    expect(typeof homeownerService.getPlants).toBe('function');
    expect(typeof homeownerService.getAlerts).toBe('function');
    expect(typeof homeownerService.getWorkOrders).toBe('function');

    expect(typeof technicianService.getDashboard).toBe('function');
    expect(typeof technicianService.getAssignedWorkOrders).toBe('function');
    expect(typeof technicianService.submitInspection).toBe('function');
    expect(typeof technicianService.verifyRecovery).toBe('function');

    expect(typeof weatherService.getPlantWeather).toBe('function');
    expect(typeof weatherService.getOutages).toBe('function');
  });
});
