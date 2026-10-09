import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SolarProvider } from '../context/SolarContext';
import { ToastProvider } from '../components/common/Toast';
import MaintenancePage from '../pages/MaintenancePage';
import { maintenanceService } from '../services/maintenanceService';

const renderMaintenancePage = () => {
  return render(
    <SolarProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={['/maintenance']}>
          <MaintenancePage />
        </MemoryRouter>
      </ToastProvider>
    </SolarProvider>
  );
};

describe('MaintenancePage Component Suite', () => {
  beforeEach(() => {
    maintenanceService.resetStore();
  });

  it('renders maintenance logs, overview cards, and actions taken', async () => {
    const { unmount } = renderMaintenancePage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Preventive Maintenance & Service Verification History/i })).toBeInTheDocument();
      expect(screen.getByText('Completed Interventions')).toBeInTheDocument();
      expect(screen.getByText('Total Maintenance Spend')).toBeInTheDocument();

      // Log records
      expect(screen.getByText(/WO-801/)).toBeInTheDocument();
      expect(screen.getByText('Afternoon Tree Foliage Shading Remediation')).toBeInTheDocument();
      expect(screen.getByText(/WO-802/)).toBeInTheDocument();
      expect(screen.getByText('Demineralized Water Array Wash & Dust Removal')).toBeInTheDocument();
    });

    unmount();
  });

  it('opens and displays the field verification evidence modal', async () => {
    const { unmount } = renderMaintenancePage();

    await waitFor(() => {
      expect(screen.getByText(/WO-801/)).toBeInTheDocument();
    });

    const evidenceBtns = screen.getAllByRole('button', { name: /Verification Evidence/i });
    fireEvent.click(evidenceBtns[0]);

    await waitFor(() => {
      expect(screen.getByText(/Field Verification Evidence: WO-801/i)).toBeInTheDocument();
      expect(screen.getByText(/Yield Uplift \/ Recovery/i)).toBeInTheDocument();
      expect(screen.getAllByText('+33.4%')[0]).toBeInTheDocument();
      expect(screen.getByText(/String Voc \/ Isc Test/i)).toBeInTheDocument();
      expect(screen.getByText(/Technician Verification Sign-Off:/i)).toBeInTheDocument();
    });

    // Close modal
    const closeBtn = screen.getByRole('button', { name: /Close Evidence Dossier/i });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Field Verification Evidence: WO-801/i)).not.toBeInTheDocument();
    });

    unmount();
  });
});
