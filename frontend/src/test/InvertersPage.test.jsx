import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SolarProvider } from '../context/SolarContext';
import { ToastProvider } from '../components/common/Toast';
import InvertersPage from '../pages/InvertersPage';

const renderInvertersPage = () => {
  return render(
    <SolarProvider>
      <ToastProvider>
        <MemoryRouter>
          <InvertersPage />
        </MemoryRouter>
      </ToastProvider>
    </SolarProvider>
  );
};

describe('InvertersPage Component & Diagnostics Suite', () => {
  it('renders page header, fleet summary cards, and inverters table', async () => {
    renderInvertersPage();

    await waitFor(() => {
      expect(screen.getByText('Single-String & Multi-MPPT Inverters Fleet')).toBeInTheDocument();
      expect(screen.getByText('Registered Inverters')).toBeInTheDocument();
      expect(screen.getByText('INV-101')).toBeInTheDocument();
      expect(screen.getByText('INV-102')).toBeInTheDocument();
    });
  });

  it('searches for inverter by model name', async () => {
    renderInvertersPage();

    await waitFor(() => {
      expect(screen.getByText('INV-101')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by inverter ID, serial #, model, or plant/i);
    fireEvent.change(searchInput, { target: { value: 'Growatt' } });

    await waitFor(() => {
      expect(screen.getByText('INV-105')).toBeInTheDocument();
      expect(screen.queryByText('INV-101')).not.toBeInTheDocument();
    });
  });

  it('filters inverters by diagnostic status', async () => {
    renderInvertersPage();

    await waitFor(() => {
      expect(screen.getByText('INV-101')).toBeInTheDocument();
    });

    const statusSelect = screen.getByLabelText(/Filter by diagnostic state/i);
    fireEvent.change(statusSelect, { target: { value: 'OFFLINE' } });

    await waitFor(() => {
      expect(screen.getByText('INV-106B')).toBeInTheDocument();
      expect(screen.queryByText('INV-101')).not.toBeInTheDocument();
    });
  });

  it('displays missing readings as dashed fallback "--" instead of zero (INV-105 missing temp)', async () => {
    renderInvertersPage();

    await waitFor(() => {
      expect(screen.getByText('INV-105')).toBeInTheDocument();
    });

    // Inverter 105 has temperatureC: null, should not show "0 °C"
    expect(screen.queryByText('0 °C')).not.toBeInTheDocument();
  });
});
