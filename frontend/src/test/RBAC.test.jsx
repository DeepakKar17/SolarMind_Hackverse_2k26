import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';
import { AuthContext } from '../context/AuthContext';
import { ProtectedRoute, RoleGuard, PermissionGate } from '../components/auth';
import { usePermissions, ROLES } from '../hooks/usePermissions';

// Test harness component to test usePermissions hook
const PermissionsInspector = ({ testPlant, testWorkOrder }) => {
  const perms = usePermissions();
  return (
    <div>
      <div data-testid="user-role">{perms.userRole}</div>
      <div data-testid="is-admin">{perms.isAdmin ? 'true' : 'false'}</div>
      <div data-testid="is-homeowner">{perms.isHomeowner ? 'true' : 'false'}</div>
      <div data-testid="is-technician">{perms.isTechnician ? 'true' : 'false'}</div>
      <div data-testid="can-manage-plants">{perms.canManagePlants() ? 'true' : 'false'}</div>
      <div data-testid="can-request-diagnosis">{perms.canRequestDiagnosis() ? 'true' : 'false'}</div>
      <div data-testid="can-manage-users">{perms.canManageUsers() ? 'true' : 'false'}</div>
      <div data-testid="can-view-plant">
        {perms.canViewPlant(testPlant) ? 'true' : 'false'}
      </div>
      <div data-testid="can-view-wo">
        {perms.canViewWorkOrder(testWorkOrder) ? 'true' : 'false'}
      </div>
      <div data-testid="can-modify-wo">
        {perms.canModifyWorkOrder(testWorkOrder) ? 'true' : 'false'}
      </div>
    </div>
  );
};

const renderWithAuthContext = (ui, authValue = {}, initialRoute = '/') => {
  const defaultAuth = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    devLogin: vi.fn(),
    clearError: vi.fn(),
    ...authValue,
  };

  return render(
    <AuthContext.Provider value={defaultAuth}>
      <MemoryRouter initialEntries={[initialRoute]}>
        {ui}
      </MemoryRouter>
    </AuthContext.Provider>
  );
};

describe('SolarMind Frontend RBAC Suite', () => {
  describe('ProtectedRoute Component', () => {
    it('redirects unauthenticated users to /login', async () => {
      renderWithAuthContext(
        <Routes>
          <Route path="/login" element={<div>Login Page Target</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Protected Dashboard</div>} />
          </Route>
        </Routes>,
        { isAuthenticated: false, user: null },
        '/dashboard'
      );

      await waitFor(() => {
        expect(screen.getByText('Login Page Target')).toBeInTheDocument();
        expect(screen.queryByText('Protected Dashboard')).not.toBeInTheDocument();
      });
    });

    it('renders protected content when user is authenticated', async () => {
      renderWithAuthContext(
        <Routes>
          <Route path="/login" element={<div>Login Page Target</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Protected Dashboard</div>} />
          </Route>
        </Routes>,
        { isAuthenticated: true, user: { id: 1, role: 'homeowner' } },
        '/dashboard'
      );

      await waitFor(() => {
        expect(screen.getByText('Protected Dashboard')).toBeInTheDocument();
        expect(screen.queryByText('Login Page Target')).not.toBeInTheDocument();
      });
    });
  });

  describe('RoleGuard Component', () => {
    it('allows access when user role is in allowedRoles', async () => {
      renderWithAuthContext(
        <Routes>
          <Route path="/unauthorized" element={<div>Access Denied</div>} />
          <Route element={<RoleGuard allowedRoles={['admin']} />}>
            <Route path="/admin/fleet" element={<div>Admin Fleet Control</div>} />
          </Route>
        </Routes>,
        { isAuthenticated: true, user: { id: 10, role: 'admin' } },
        '/admin/fleet'
      );

      await waitFor(() => {
        expect(screen.getByText('Admin Fleet Control')).toBeInTheDocument();
        expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
      });
    });

    it('redirects unauthorized roles to /unauthorized', async () => {
      renderWithAuthContext(
        <Routes>
          <Route path="/unauthorized" element={<div>Access Denied</div>} />
          <Route element={<RoleGuard allowedRoles={['admin']} />}>
            <Route path="/admin/fleet" element={<div>Admin Fleet Control</div>} />
          </Route>
        </Routes>,
        { isAuthenticated: true, user: { id: 20, role: 'homeowner' } },
        '/admin/fleet'
      );

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
        expect(screen.queryByText('Admin Fleet Control')).not.toBeInTheDocument();
      });
    });
  });

  describe('PermissionGate Component', () => {
    it('renders children when role matches allowedRoles', () => {
      renderWithAuthContext(
        <PermissionGate allowedRoles={['admin', 'technician']}>
          <button>Calibrate Inverter</button>
        </PermissionGate>,
        { isAuthenticated: true, user: { id: 3, role: 'technician' } }
      );

      expect(screen.getByText('Calibrate Inverter')).toBeInTheDocument();
    });

    it('renders fallback when role is forbidden', () => {
      renderWithAuthContext(
        <PermissionGate
          allowedRoles={['admin']}
          fallback={<span>Admin authorization required</span>}
        >
          <button>Delete Plant Record</button>
        </PermissionGate>,
        { isAuthenticated: true, user: { id: 4, role: 'homeowner' } }
      );

      expect(screen.getByText('Admin authorization required')).toBeInTheDocument();
      expect(screen.queryByText('Delete Plant Record')).not.toBeInTheDocument();
    });

    it('evaluates dynamic permissionCheck callback', () => {
      const isOwner = (perms) => perms.canViewPlant({ owner_id: 42 });

      renderWithAuthContext(
        <PermissionGate permissionCheck={isOwner} fallback={<span>Restricted Asset</span>}>
          <div>Plant Telemetry Dossier</div>
        </PermissionGate>,
        { isAuthenticated: true, user: { id: 42, role: 'homeowner' } }
      );

      expect(screen.getByText('Plant Telemetry Dossier')).toBeInTheDocument();
    });
  });

  describe('usePermissions Hook & Resource Level Rules', () => {
    it('grants administrative permissions correctly for ADMIN role', () => {
      renderWithAuthContext(
        <PermissionsInspector
          testPlant={{ id: 99, owner_id: 888 }}
          testWorkOrder={{ id: 50, technician_id: 777 }}
        />,
        { isAuthenticated: true, user: { id: 1, role: 'admin' } }
      );

      expect(screen.getByTestId('user-role')).toHaveTextContent('admin');
      expect(screen.getByTestId('is-admin')).toHaveTextContent('true');
      expect(screen.getByTestId('can-manage-plants')).toHaveTextContent('true');
      expect(screen.getByTestId('can-manage-users')).toHaveTextContent('true');
      expect(screen.getByTestId('can-view-plant')).toHaveTextContent('true');
      expect(screen.getByTestId('can-view-wo')).toHaveTextContent('true');
      expect(screen.getByTestId('can-modify-wo')).toHaveTextContent('true');
    });

    it('enforces plant and work order scoping for HOMEOWNER role', () => {
      // Homeowner with user id 55 accessing their own plant vs another plant
      const { unmount } = renderWithAuthContext(
        <PermissionsInspector
          testPlant={{ id: 1, owner_id: 55 }}
          testWorkOrder={{ id: 10, plant: { owner_id: 55 } }}
        />,
        { isAuthenticated: true, user: { id: 55, role: 'homeowner' } }
      );

      expect(screen.getByTestId('user-role')).toHaveTextContent('homeowner');
      expect(screen.getByTestId('is-homeowner')).toHaveTextContent('true');
      expect(screen.getByTestId('can-manage-plants')).toHaveTextContent('false');
      expect(screen.getByTestId('can-manage-users')).toHaveTextContent('false');
      expect(screen.getByTestId('can-request-diagnosis')).toHaveTextContent('true');
      expect(screen.getByTestId('can-view-plant')).toHaveTextContent('true');
      expect(screen.getByTestId('can-view-wo')).toHaveTextContent('true');
      expect(screen.getByTestId('can-modify-wo')).toHaveTextContent('false');

      unmount();

      // Homeowner attempting to access unowned plant
      renderWithAuthContext(
        <PermissionsInspector
          testPlant={{ id: 2, owner_id: 999 }}
          testWorkOrder={{ id: 20, plant: { owner_id: 999 } }}
        />,
        { isAuthenticated: true, user: { id: 55, role: 'homeowner' } }
      );

      expect(screen.getByTestId('can-view-plant')).toHaveTextContent('false');
      expect(screen.getByTestId('can-view-wo')).toHaveTextContent('false');
    });

    it('enforces assignment scoping for TECHNICIAN role', () => {
      // Technician with user id 77 accessing assigned vs unassigned work order
      const { unmount } = renderWithAuthContext(
        <PermissionsInspector
          testPlant={{ id: 1, owner_id: 20 }}
          testWorkOrder={{ id: 100, technician_id: 77 }}
        />,
        { isAuthenticated: true, user: { id: 77, role: 'technician' } }
      );

      expect(screen.getByTestId('user-role')).toHaveTextContent('technician');
      expect(screen.getByTestId('is-technician')).toHaveTextContent('true');
      expect(screen.getByTestId('can-manage-plants')).toHaveTextContent('false');
      expect(screen.getByTestId('can-view-wo')).toHaveTextContent('true');
      expect(screen.getByTestId('can-modify-wo')).toHaveTextContent('true');

      unmount();

      // Unassigned work order
      renderWithAuthContext(
        <PermissionsInspector
          testPlant={{ id: 1, owner_id: 20 }}
          testWorkOrder={{ id: 101, technician_id: 999 }}
        />,
        { isAuthenticated: true, user: { id: 77, role: 'technician' } }
      );

      expect(screen.getByTestId('can-view-wo')).toHaveTextContent('false');
      expect(screen.getByTestId('can-modify-wo')).toHaveTextContent('false');
    });
  });
});
