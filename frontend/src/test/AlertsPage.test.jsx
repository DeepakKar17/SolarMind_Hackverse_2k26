import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SolarProvider } from '../context/SolarContext';
import { ToastProvider } from '../components/common/Toast';
import AlertsPage from '../pages/AlertsPage';
import { alertService } from '../services/alertService';

const renderAlertsPage = () => {
  return render(
    <SolarProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={['/alerts']}>
          <AlertsPage />
        </MemoryRouter>
      </ToastProvider>
    </SolarProvider>
  );
};

describe('AlertsPage Component Suite', () => {
  beforeEach(() => {
    alertService.resetStore();
  });

  it('renders alarms list, KPI summary cards, and search filters', async () => {
    const { unmount } = renderAlertsPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /System Alarms & Diagnostic Alerts/i })).toBeInTheDocument();
      expect(screen.getByText('Critical Alarms')).toBeInTheDocument();
      expect(screen.getByText('Unacknowledged Events')).toBeInTheDocument();

      // Alerts
      expect(screen.getByText('ALT-901')).toBeInTheDocument();
      expect(screen.getByText('GRID_OVERVOLTAGE_TRIP')).toBeInTheDocument();
      expect(screen.getByText('ALT-902')).toBeInTheDocument();
    });

    unmount();
  });

  it('acknowledges an individual unacknowledged alarm', async () => {
    const { unmount } = renderAlertsPage();

    await waitFor(() => {
      expect(screen.getByText('ALT-901')).toBeInTheDocument();
    });

    const ackButtons = screen.getAllByRole('button', { name: /^Acknowledge$/i });
    expect(ackButtons.length).toBeGreaterThan(0);
    fireEvent.click(ackButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Alert ALT-901 successfully acknowledged/i)).toBeInTheDocument();
    });

    unmount();
  });

  it('filters alarms by search query', async () => {
    const { unmount } = renderAlertsPage();

    await waitFor(() => {
      expect(screen.getByText('ALT-901')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search alerts by ID, alarm code/i);
    fireEvent.change(searchInput, { target: { value: 'Thermal' } });

    await waitFor(() => {
      expect(screen.getByText('ALT-903')).toBeInTheDocument();
      expect(screen.queryByText('ALT-901')).not.toBeInTheDocument();
    });

    unmount();
  });
});
