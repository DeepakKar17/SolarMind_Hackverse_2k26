import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SolarProvider } from '../context/SolarContext';
import { ToastProvider } from '../components/common/Toast';
import PlantDetailPage from '../pages/PlantDetailPage';
import { plantService } from '../services/plantService';

const renderPlantDetail = (plantId = '1') => {
  return render(
    <SolarProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/plants/${plantId}`]}>
          <Routes>
            <Route path="/plants/:plantId" element={<PlantDetailPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </SolarProvider>
  );
};

describe('PlantDetailPage Component Suite', () => {
  beforeEach(() => {
    plantService.resetStore();
  });

  it('renders detailed plant header, specs, KPI cards, inverters, and charts', async () => {
    renderPlantDetail('1');

    await waitFor(() => {
      // Plant title & specs
      expect(screen.getByRole('heading', { name: 'Residential Rooftop String-1' })).toBeInTheDocument();
      expect(screen.getByText(/PLANT-101/)).toBeInTheDocument();
      expect(screen.getByText('Installation Blueprint & Electrical Topology')).toBeInTheDocument();

      // Inverters fleet section
      expect(screen.getByText(/Associated Inverters Fleet/i)).toBeInTheDocument();

      // Generation curves & telemetry
      expect(screen.getByText('Daylight Generation vs Clear-Sky Model')).toBeInTheDocument();
      expect(screen.getByText('Recent Telemetry & Electrical Operating Parameters')).toBeInTheDocument();

      // Active diagnoses & maintenance history
      expect(screen.getByText(/Active Diagnoses & Fault Alarms/i)).toBeInTheDocument();
      expect(screen.getByText(/Maintenance & Service History/i)).toBeInTheDocument();
    });
  });

  it('handles unconfigured GPS coordinates without fabricating fake values', async () => {
    renderPlantDetail('5');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sahyadri Farmstead Micro-PV' })).toBeInTheDocument();
      expect(screen.getByText(/Not configured \/ Unlisted/i)).toBeInTheDocument();
    });
  });

  it('displays error / not found state when invalid plantId is requested', async () => {
    renderPlantDetail('99999');

    await waitFor(() => {
      expect(screen.getByText('Plant Not Found')).toBeInTheDocument();
      expect(screen.getByText(/Solar Plant Unavailable/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Back to Plants Fleet/i })).toBeInTheDocument();
    });
  });

  it('opens Edit Plant modal from detail page', async () => {
    renderPlantDetail('1');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Residential Rooftop String-1' })).toBeInTheDocument();
    });

    const editBtn = screen.getByRole('button', { name: /Edit Plant/i });
    fireEvent.click(editBtn);

    await waitFor(() => {
      expect(screen.getByText(/Edit Plant: Residential Rooftop String-1/i)).toBeInTheDocument();
    });
  });
});
