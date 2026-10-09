import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { AuthContext } from '../context/AuthContext';
import { ToastProvider } from '../components/common/Toast';
import { AdminUsersPage } from '../pages/admin/AdminUsersPage';
import { AdminDiagnosisRulesPage } from '../pages/admin/AdminDiagnosisRulesPage';
import { AdminIntegrationsPage } from '../pages/admin/AdminIntegrationsPage';
import { AdminAuditLogsPage } from '../pages/admin/AdminAuditLogsPage';
import { adminService } from '../services/adminService';

const renderWithContext = (ui, user = { id: 1, email: 'admin@solarmind.io', full_name: 'Admin User', role: 'admin' }) => {
  const authValue = {
    user,
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
  };

  return render(
    <AuthContext.Provider value={authValue}>
      <ToastProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ToastProvider>
    </AuthContext.Provider>
  );
};

describe('Admin Management Module - Frontend Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
  });

  // =========================================================================
  // 1. USER MANAGEMENT TESTS
  // =========================================================================
  describe('AdminUsersPage', () => {
    it('renders user list, handles search, and loads accounts', async () => {
      renderWithContext(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByText('User Account & Role Assignments')).toBeInTheDocument();
        expect(screen.getByText('Dr. Vikram Rao')).toBeInTheDocument();
        expect(screen.getByText('Deepak Sharma')).toBeInTheDocument();
      });
    });

    it('opens Invite User modal and provisions a new user account', async () => {
      const createUserSpy = vi.spyOn(adminService, 'createUser').mockResolvedValueOnce({
        id: 99,
        email: 'newuser@solarmind.io',
        full_name: 'New Test User',
        role: 'technician',
      });

      renderWithContext(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Invite New User/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Invite New User/i }));

      expect(screen.getAllByText('Invite New User').length).toBeGreaterThanOrEqual(1);

      const nameInput = screen.getByLabelText(/Full Name/i);
      const emailInput = screen.getByLabelText(/Email Address/i);

      fireEvent.change(nameInput, { target: { value: 'New Test User' } });
      fireEvent.change(emailInput, { target: { value: 'newuser@solarmind.io' } });

      const sendInviteBtn = screen.getByRole('button', { name: /Provision User/i });
      fireEvent.click(sendInviteBtn);

      await waitFor(() => {
        expect(createUserSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            full_name: 'New Test User',
            email: 'newuser@solarmind.io',
          })
        );
      });
    });

    it('prevents self-deactivation with safeguard alert', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      renderWithContext(<AdminUsersPage />, {
        id: 1,
        email: 'vikram.rao@solarmind.io',
        full_name: 'Dr. Vikram Rao',
        role: 'admin',
      });

      await waitFor(() => {
        expect(screen.getByText('Dr. Vikram Rao')).toBeInTheDocument();
      });

      // Find Deactivate button for Vikram Rao (id: 1)
      const deactivateButtons = screen.getAllByRole('button', { name: /Deactivate/i });
      fireEvent.click(deactivateButtons[0]);

      expect(alertSpy).toHaveBeenCalledWith(
        expect.stringContaining('Safeguard Alert: You cannot deactivate your own active administrator account')
      );
    });

    it('opens account activity modal and shows event records', async () => {
      renderWithContext(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByText('Dr. Vikram Rao')).toBeInTheDocument();
      });

      const activityButtons = screen.getAllByRole('button', { name: /Activity/i });
      fireEvent.click(activityButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/Recent Audit Trail:/i)).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // 2. DIAGNOSIS RULES TESTS
  // =========================================================================
  describe('AdminDiagnosisRulesPage', () => {
    it('renders fault rules catalog and opens threshold edit modal', async () => {
      const updateRuleSpy = vi.spyOn(adminService, 'updateFaultRule').mockResolvedValueOnce({
        id: 'RULE-OPEN-CIRCUIT',
        threshold_value: 0.35,
        version: 2,
      });

      renderWithContext(<AdminDiagnosisRulesPage />);

      await waitFor(() => {
        expect(screen.getByText('Diagnosis Rules Configuration Engine')).toBeInTheDocument();
        expect(screen.getByText('String Open-Circuit Detection')).toBeInTheDocument();
      });

      const configButtons = screen.getAllByRole('button', { name: /Configure/i });
      fireEvent.click(configButtons[0]);

      expect(screen.getByText(/Configure Rule: String Open-Circuit Detection/i)).toBeInTheDocument();

      const thresholdInput = screen.getByLabelText(/Threshold Value/i);
      fireEvent.change(thresholdInput, { target: { value: '0.35' } });

      const saveBtn = screen.getByRole('button', { name: /Save & Bump Version/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(updateRuleSpy).toHaveBeenCalledWith(
          'RULE-OPEN-CIRCUIT',
          expect.objectContaining({
            threshold_value: 0.35,
          })
        );
      });
    });

    it('triggers threshold rollback confirmation and action', async () => {
      // Mock rules with previous threshold value so rollback button is displayed
      vi.spyOn(adminService, 'getFaultRules').mockResolvedValueOnce([
        {
          id: 'RULE-OPEN-CIRCUIT',
          name: 'String Open-Circuit Detection',
          category: 'Electrical Topology',
          severity: 'CRITICAL',
          threshold_value: 0.35,
          threshold_unit: 'amperes',
          previous_threshold_value: 0.2,
          version: 2,
          is_active: true,
        },
      ]);

      const rollbackSpy = vi.spyOn(adminService, 'rollbackFaultRule').mockResolvedValueOnce({
        id: 'RULE-OPEN-CIRCUIT',
        threshold_value: 0.2,
        version: 1,
      });

      renderWithContext(<AdminDiagnosisRulesPage />);

      await waitFor(() => {
        expect(screen.getByText('String Open-Circuit Detection')).toBeInTheDocument();
      });

      const rollbackButton = screen.getByTitle('Rollback to previous threshold');
      fireEvent.click(rollbackButton);

      await waitFor(() => {
        expect(rollbackSpy).toHaveBeenCalledWith('RULE-OPEN-CIRCUIT');
      });
    });
  });

  // =========================================================================
  // 3. HARDWARE INTEGRATIONS TESTS
  // =========================================================================
  describe('AdminIntegrationsPage', () => {
    it('renders integrations with masked credentials and supports test-connection action', async () => {
      const testIntegSpy = vi.spyOn(adminService, 'testIntegration').mockResolvedValueOnce({
        status: 'CONNECTED',
        latency_ms: 68,
        message: 'Ping successful',
      });

      renderWithContext(<AdminIntegrationsPage />);

      await waitFor(() => {
        expect(screen.getByText('Hardware OpenAPI & Integration Connectors')).toBeInTheDocument();
        expect(screen.getByText('Deye Cloud Developer OpenAPI')).toBeInTheDocument();
        expect(screen.getByText('Sungrow iSolarCloud Inverter Gateway')).toBeInTheDocument();
      });

      // Find Test Ping button for Deye Cloud
      const testButtons = screen.getAllByRole('button', { name: /Test Ping/i });
      fireEvent.click(testButtons[0]);

      await waitFor(() => {
        expect(testIntegSpy).toHaveBeenCalledWith('deye-cloud');
      });
    });

    it('opens integration credentials edit modal and saves configuration', async () => {
      const updateIntegSpy = vi.spyOn(adminService, 'updateIntegration').mockResolvedValueOnce({
        id: 'deye-cloud',
        status: 'CONNECTED',
      });

      renderWithContext(<AdminIntegrationsPage />);

      await waitFor(() => {
        expect(screen.getByText('Deye Cloud Developer OpenAPI')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /Edit Credentials/i });
      fireEvent.click(editButtons[0]);

      expect(screen.getByText(/Configure: Deye Cloud Developer OpenAPI/i)).toBeInTheDocument();

      const appIdInput = screen.getByLabelText(/App ID \/ Client Identifier/i);
      fireEvent.change(appIdInput, { target: { value: 'deye_updated_app_id' } });

      const saveBtn = screen.getByRole('button', { name: /Save Configuration/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(updateIntegSpy).toHaveBeenCalledWith(
          'deye-cloud',
          expect.objectContaining({
            app_id: 'deye_updated_app_id',
          })
        );
      });
    });
  });

  // =========================================================================
  // 4. AUDIT LOGS TESTS
  // =========================================================================
  describe('AdminAuditLogsPage', () => {
    it('renders audit trail table and filters events', async () => {
      renderWithContext(<AdminAuditLogsPage />);

      await waitFor(() => {
        expect(screen.getByText('Audit & Security Event Trail')).toBeInTheDocument();
        expect(screen.getByText('EVT-9041')).toBeInTheDocument();
        expect(screen.getByText('EVT-9040')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search audit trail...');
      fireEvent.change(searchInput, { target: { value: 'Deye' } });

      expect(screen.getByText('EVT-9040')).toBeInTheDocument();
      expect(screen.queryByText('EVT-9041')).not.toBeInTheDocument();
    });
  });
});
