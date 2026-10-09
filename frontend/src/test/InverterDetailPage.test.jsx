import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SolarProvider } from '../context/SolarContext';
import { ToastProvider } from '../components/common/Toast';
import InverterDetailPage from '../pages/InverterDetailPage';

const renderInverterDetail = (inverterId = 'INV-101') => {
  return render(
    <SolarProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/inverters/${inverterId}`]}>
          <Routes>
            <Route path="/inverters/:inverterId" element={<InverterDetailPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </SolarProvider>
  );
};

describe('InverterDetailPage Component Suite', () => {
  it('renders standard single-string inverter details, KPI cards, and MPPT architecture (INV-101)', async () => {
    const { unmount } = renderInverterDetail('INV-101');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Inverter Unit: INV-101/i })).toBeInTheDocument();
      expect(screen.getByText(/SM-1010-09884/)).toBeInTheDocument();
      expect(screen.getAllByText(/Normal Operation/i)[0]).toBeInTheDocument();

      // MPPT and String topology
      expect(screen.getByText(/MPPT Channel A/i)).toBeInTheDocument();
      expect(screen.getByText(/String 1 \(South Roof\)/i)).toBeInTheDocument();

      // Curves and Specs
      expect(screen.getByText('High-Resolution Telemetry & Dynamic Operating Curves')).toBeInTheDocument();
      expect(screen.getByText('Hardware Specification & Operational Telemetry Metadata')).toBeInTheDocument();
    });

    unmount();
  });

  it('renders multi-MPPT multi-string inverter configuration without assuming single string (INV-104A)', async () => {
    const { unmount } = renderInverterDetail('INV-104A');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Inverter Unit: INV-104A/i })).toBeInTheDocument();
      expect(screen.getByText(/2 MPPTs, 2 Strings/i)).toBeInTheDocument();
      expect(screen.getByText(/MPPT Channel 1 \(East Canopy\)/i)).toBeInTheDocument();
      expect(screen.getByText(/MPPT Channel 2 \(West Canopy\)/i)).toBeInTheDocument();
      expect(screen.getByText(/String 1 \(Canopy East 1\)/i)).toBeInTheDocument();
      expect(screen.getByText(/String 2 \(Canopy West 1\)/i)).toBeInTheDocument();
    });

    unmount();
  });

  it('handles missing temperature reading without coercing to zero (INV-105)', async () => {
    const { unmount } = renderInverterDetail('INV-105');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Inverter Unit: INV-105/i })).toBeInTheDocument();
      expect(screen.getByText(/Sensor not installed/i)).toBeInTheDocument();
    });

    // Switch to thermal tab in curves
    const tempTabBtn = screen.getByRole('button', { name: /Thermal/i });
    fireEvent.click(tempTabBtn);

    await waitFor(() => {
      expect(screen.getByText(/Temperature Sensor Uninstalled or Telemetry Unavailable/i)).toBeInTheDocument();
    });

    unmount();
  });

  it('renders stale telemetry diagnostic badge for INV-106A', async () => {
    const { unmount } = renderInverterDetail('INV-106A');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Inverter Unit: INV-106A/i })).toBeInTheDocument();
      expect(screen.getAllByText(/Stale Telemetry/i)[0]).toBeInTheDocument();
    });

    unmount();
  });

  it('renders active hardware alarms and offline state for INV-106B', async () => {
    const { unmount } = renderInverterDetail('INV-106B');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Inverter Unit: INV-106B/i })).toBeInTheDocument();
      expect(screen.getAllByText(/Offline \/ Shutdown/i)[0]).toBeInTheDocument();
      expect(screen.getByText('DC_ISOLATION_FAULT_SHUTDOWN')).toBeInTheDocument();
    });

    unmount();
  });

  it('displays error / not found state when invalid inverterId is requested', async () => {
    const { unmount } = renderInverterDetail('INV-99999');

    await waitFor(() => {
      expect(screen.getByText('Inverter Not Found')).toBeInTheDocument();
      expect(screen.getByText(/Inverter Unit Unavailable/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Back to Inverters Fleet/i })).toBeInTheDocument();
    });

    unmount();
  });
});
