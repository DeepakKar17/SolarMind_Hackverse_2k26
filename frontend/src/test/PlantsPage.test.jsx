import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SolarProvider } from '../context/SolarContext';
import { ToastProvider } from '../components/common/Toast';
import PlantsPage from '../pages/PlantsPage';
import { plantService } from '../services/plantService';

const renderPlantsPage = () => {
  return render(
    <SolarProvider>
      <ToastProvider>
        <MemoryRouter>
          <PlantsPage />
        </MemoryRouter>
      </ToastProvider>
    </SolarProvider>
  );
};

describe('PlantsPage Component & Filter Suite', () => {
  beforeEach(() => {
    plantService.resetStore();
  });

  it('renders page header, fleet summary cards, and plants table', async () => {
    renderPlantsPage();

    await waitFor(() => {
      expect(screen.getByText('Solar Generation Plants')).toBeInTheDocument();
      expect(screen.getByText('Registered Fleet Total')).toBeInTheDocument();
      expect(screen.getByText('Residential Rooftop String-1')).toBeInTheDocument();
      expect(screen.getByText('PLANT-101')).toBeInTheDocument();
    });
  });

  it('filters plants list when typing in search input', async () => {
    renderPlantsPage();

    await waitFor(() => {
      expect(screen.getByText('Residential Rooftop String-1')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by plant name, location, or ID/i);
    fireEvent.change(searchInput, { target: { value: 'EcoVilla' } });

    await waitFor(() => {
      expect(screen.getByText('EcoVilla Solar Array B')).toBeInTheDocument();
      expect(screen.queryByText('Residential Rooftop String-1')).not.toBeInTheDocument();
    });
  });

  it('filters plants list when selecting operational status', async () => {
    renderPlantsPage();

    await waitFor(() => {
      expect(screen.getByText('Residential Rooftop String-1')).toBeInTheDocument();
    });

    const statusSelect = screen.getByLabelText(/Filter by operational status/i);
    fireEvent.change(statusSelect, { target: { value: 'WARNING' } });

    await waitFor(() => {
      expect(screen.getByText('Suburban Net-Metered Array C')).toBeInTheDocument();
      expect(screen.queryByText('Residential Rooftop String-1')).not.toBeInTheDocument();
    });
  });

  it('opens Add Solar Plant modal and shows validation errors on empty submit', async () => {
    renderPlantsPage();

    await waitFor(() => {
      expect(screen.getByText('Solar Generation Plants')).toBeInTheDocument();
    });

    const addButtons = screen.getAllByRole('button', { name: /Add Solar Plant/i });
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Register New Solar Generation Plant')).toBeInTheDocument();
    });

    // Clear name and submit
    const nameInput = screen.getByLabelText(/Plant Name/i);
    fireEvent.change(nameInput, { target: { value: '' } });

    const saveButton = screen.getByRole('button', { name: /Save Plant/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Plant name is required.')).toBeInTheDocument();
    });
  });

  it('successfully creates a new plant via Add Modal and updates the table', async () => {
    renderPlantsPage();

    await waitFor(() => {
      expect(screen.getByText('Solar Generation Plants')).toBeInTheDocument();
    });

    const addButtons = screen.getAllByRole('button', { name: /Add Solar Plant/i });
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Register New Solar Generation Plant')).toBeInTheDocument();
    });

    // Fill out form
    fireEvent.change(screen.getByLabelText(/Plant Name/i), { target: { value: 'Alpha SolarArray Horizon Zeta' } });
    fireEvent.change(screen.getByLabelText(/Installation Location/i), { target: { value: 'Nagpur, Maharashtra' } });
    fireEvent.change(screen.getByLabelText(/Installed Capacity \(kWp\)/i), { target: { value: '9.0' } });
    fireEvent.change(screen.getByLabelText(/PV Panel Count/i), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText(/Module Wattage \(W\)/i), { target: { value: '450' } });
    fireEvent.change(screen.getByLabelText(/Utility Tariff/i), { target: { value: '8.25' } });

    const saveButton = screen.getByRole('button', { name: /Save Plant/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.queryByText('Register New Solar Generation Plant')).not.toBeInTheDocument();
      expect(screen.getByText('Alpha SolarArray Horizon Zeta')).toBeInTheDocument();
    });
  });
});
