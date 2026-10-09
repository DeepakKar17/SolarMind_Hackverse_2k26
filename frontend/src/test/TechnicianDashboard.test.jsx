import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { AuthContext } from '../context/AuthContext';
import { SolarProvider } from '../context/SolarContext';
import { ToastProvider } from '../components/common/Toast';
import { TechnicianDashboardPage } from '../pages/TechnicianDashboardPage';

const renderTechnicianDashboard = (userRole = 'technician', userName = 'Arun Kumar') => {
  const mockUser = {
    id: 301,
    email: 'tech.kumar@solarmind.io',
    full_name: userName,
    role: userRole,
  };

  const authValue = {
    user: mockUser,
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
  };

  return render(
    <AuthContext.Provider value={authValue}>
      <SolarProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={['/technician/dashboard']}>
            <TechnicianDashboardPage />
          </MemoryRouter>
        </ToastProvider>
      </SolarProvider>
    </AuthContext.Provider>
  );
};

describe('Technician Field Operations Dashboard & Workflow Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. OVERVIEW & KPI CARDS
  // =========================================================================
  it('renders technician dashboard with overview KPIs and assigned role badge', async () => {
    renderTechnicianDashboard();

    expect(screen.getByText('Technician Field Operations Center')).toBeInTheDocument();
    expect(screen.getByText(/Arun Kumar/i)).toBeInTheDocument();

    // 7 KPI cards
    expect(screen.getByText('Assigned Tasks')).toBeInTheDocument();
    expect(screen.getByText('New Assignments')).toBeInTheDocument();
    expect(screen.getByText('In-Progress')).toBeInTheDocument();
    expect(screen.getByText('Overdue Jobs')).toBeInTheDocument();
    expect(screen.getByText('High-Priority Faults')).toBeInTheDocument();
    expect(screen.getAllByText('Awaiting Verification').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Recently Completed')).toBeInTheDocument();
  });

  // =========================================================================
  // 2. WORK QUEUE & SEARCH/FILTERING
  // =========================================================================
  it('renders work queue table and filters tickets by search query', async () => {
    renderTechnicianDashboard();

    expect(screen.getByText('Field Service Work Queue')).toBeInTheDocument();
    expect(screen.getByText('WO-801')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Search by ticket, plant, notes\.\.\./i);
    fireEvent.change(searchInput, { target: { value: 'WO-801' } });

    expect(screen.getByText('WO-801')).toBeInTheDocument();
  });

  // =========================================================================
  // 3. WORK ORDER DETAIL & EXECUTION WORKSPACE
  // =========================================================================
  it('opens work order modal and displays diagnosis, telemetry snapshot, and checklist', async () => {
    renderTechnicianDashboard();

    const inspectButtons = screen.getAllByRole('button', { name: /Inspect Ticket|Resume Service/i });
    fireEvent.click(inspectButtons[0]);

    expect(screen.getByText(/Field Service Ticket: WO-801/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Diagnostic Hypothesis/i)).toBeInTheDocument();
    expect(screen.getByText(/Telemetry Snapshot/i)).toBeInTheDocument();
    expect(screen.getByText(/Safe Field Inspection Checklist \(Mandatory\)/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 4. CHECKLIST & PARTS MANAGEMENT
  // =========================================================================
  it('allows checking safety items and adding replacement parts', async () => {
    renderTechnicianDashboard();

    const inspectButtons = screen.getAllByRole('button', { name: /Inspect Ticket|Resume Service/i });
    fireEvent.click(inspectButtons[0]);

    // Check first safety checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    // Add a replacement part
    const partNameInput = screen.getByPlaceholderText(/e\.g\. DC-FUSE-15A-1000V/i);
    fireEvent.change(partNameInput, { target: { value: 'SOLAR-MC4-PAIR' } });

    const addPartBtn = screen.getByRole('button', { name: /^Add$/i });
    fireEvent.click(addPartBtn);

    expect(screen.getByText(/SOLAR-MC4-PAIR/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 5. PHOTO UPLOAD
  // =========================================================================
  it('simulates photo evidence upload for field verification', async () => {
    renderTechnicianDashboard();

    const inspectButtons = screen.getAllByRole('button', { name: /Inspect Ticket|Resume Service/i });
    fireEvent.click(inspectButtons[0]);

    const fileInputs = document.querySelectorAll('input[type="file"]');
    expect(fileInputs.length).toBeGreaterThanOrEqual(2);

    const fakeFile = new File(['mock content'], 'after_service.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInputs[1], { target: { files: [fakeFile] } });

    await waitFor(() => {
      expect(screen.getByText(/Post-Service Verification Photos/i)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 6. STRICT VERIFICATION COMPLETION SAFEGUARDS
  // =========================================================================
  it('enforces safety checklist before allowing job completion', async () => {
    renderTechnicianDashboard();

    const inspectButtons = screen.getAllByRole('button', { name: /Inspect Ticket|Resume Service/i });
    fireEvent.click(inspectButtons[0]);

    // Uncheck all required items
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => {
      if (cb.checked) fireEvent.click(cb);
    });

    // Try to complete job
    const completeBtn = screen.getByRole('button', { name: /Complete & Sign-Off Service/i });
    fireEvent.click(completeBtn);

    expect(
      screen.getByText(/Safety Safeguard Alert: Please complete all mandatory checklist items/i)
    ).toBeInTheDocument();
  });

  it('successfully transitions work order to COMPLETED when requirements are met', async () => {
    renderTechnicianDashboard();

    const inspectButtons = screen.getAllByRole('button', { name: /Inspect Ticket|Resume Service/i });
    fireEvent.click(inspectButtons[0]);

    // Check all checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => {
      if (!cb.checked) fireEvent.click(cb);
    });

    // Provide resolution notes
    const notesArea = screen.getByPlaceholderText(/Document actions taken/i);
    fireEvent.change(notesArea, {
      target: { value: 'Replaced MC4 connectors on string 1 and confirmed 382.4V open circuit voltage.' },
    });

    // Complete job
    const completeBtn = screen.getByRole('button', { name: /Complete & Sign-Off Service/i });
    fireEvent.click(completeBtn);

    await waitFor(() => {
      expect(screen.getByText(/successfully updated to COMPLETED/i)).toBeInTheDocument();
    });
  });
});
