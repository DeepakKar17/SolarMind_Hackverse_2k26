import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SolarProvider } from '../context/SolarContext';
import { ToastProvider } from '../components/common/Toast';
import DiagnosisPage from '../pages/DiagnosisPage';
import { diagnosisService } from '../services/diagnosisService';

const renderDiagnosisPage = () => {
  return render(
    <SolarProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={['/diagnosis']}>
          <Routes>
            <Route path="/diagnosis" element={<DiagnosisPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </SolarProvider>
  );
};

describe('DiagnosisPage Component Suite', () => {
  beforeEach(() => {
    diagnosisService.resetStore();
  });

  it('renders diagnosis list with KPI summary cards and data table', async () => {
    const { unmount } = renderDiagnosisPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /AI Fault Diagnosis Engine/i })).toBeInTheDocument();
      expect(screen.getByText('Active System Anomalies')).toBeInTheDocument();
      expect(screen.getByText('Total Daily Yield Deficit')).toBeInTheDocument();

      // Table records
      expect(screen.getByText('DIAG-401')).toBeInTheDocument();
      expect(screen.getByText('DIAG-402')).toBeInTheDocument();
      expect(screen.getByText('DIAG-403')).toBeInTheDocument();
    });

    unmount();
  });

  it('distinguishes ML models with confidence % from deterministic rules and suspicions', async () => {
    const { unmount } = renderDiagnosisPage();

    await waitFor(() => {
      // DIAG-401 ML model
      expect(screen.getByText('92.4% ML Match')).toBeInTheDocument();

      // DIAG-403 Deterministic rule (NO confidence %)
      expect(screen.getByText('Deterministic Rule')).toBeInTheDocument();

      // DIAG-404 Heuristic suspicion
      expect(screen.getByText(/Suspicion \(64.5% Model Match\)/i)).toBeInTheDocument();

      // DIAG-405 Insufficient telemetry
      expect(screen.getByText('Insufficient Telemetry')).toBeInTheDocument();
    });

    unmount();
  });

  it('filters diagnosis list by search query', async () => {
    const { unmount } = renderDiagnosisPage();

    await waitFor(() => {
      expect(screen.getByText('DIAG-401')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search diagnoses by ID, fault, plant/i);
    fireEvent.change(searchInput, { target: { value: 'Grid High Voltage' } });

    await waitFor(() => {
      expect(screen.getByText('DIAG-403')).toBeInTheDocument();
      expect(screen.queryByText('DIAG-401')).not.toBeInTheDocument();
    });

    unmount();
  });

  it('opens and triggers the AI Diagnostic Scan modal', async () => {
    const { unmount } = renderDiagnosisPage();

    await waitFor(() => {
      expect(screen.getByText('DIAG-401')).toBeInTheDocument();
    });

    const scanBtn = screen.getAllByRole('button', { name: /Run AI Diagnostic Scan/i })[0];
    fireEvent.click(scanBtn);

    await waitFor(() => {
      expect(screen.getByText('Run SolarMind AI Diagnostic Scan')).toBeInTheDocument();
      expect(screen.getByText('Execute AI Scan')).toBeInTheDocument();
    });

    const executeBtn = screen.getByRole('button', { name: /Execute AI Scan/i });
    fireEvent.click(executeBtn);

    await waitFor(() => {
      expect(screen.getByText(/Diagnostic Scan in Progress/i)).toBeInTheDocument();
    });

    unmount();
  });
});
