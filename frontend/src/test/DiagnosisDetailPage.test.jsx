import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SolarProvider } from '../context/SolarContext';
import { ToastProvider } from '../components/common/Toast';
import DiagnosisDetailPage from '../pages/DiagnosisDetailPage';
import { diagnosisService } from '../services/diagnosisService';

const renderDiagnosisDetailPage = (diagnosisId = 'DIAG-401') => {
  return render(
    <SolarProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/diagnosis/${diagnosisId}`]}>
          <Routes>
            <Route path="/diagnosis/:diagnosisId" element={<DiagnosisDetailPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </SolarProvider>
  );
};

describe('DiagnosisDetailPage Component Suite', () => {
  beforeEach(() => {
    diagnosisService.resetStore();
  });

  it('renders complete ML diagnosis dossier with comparative table, timeline, and loss metrics (DIAG-401)', async () => {
    const { unmount } = renderDiagnosisDetailPage('DIAG-401');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Fault Diagnosis Dossier: DIAG-401/i })).toBeInTheDocument();
      expect(screen.getAllByText(/Afternoon DC String Partial Shading Deficit/i)[0]).toBeInTheDocument();

      // ML Badge
      expect(screen.getAllByText(/92.4% ML Match/i)[0]).toBeInTheDocument();

      // Methodology card
      expect(screen.getByText(/Supervised Machine Learning Anomaly Classifier/i)).toBeInTheDocument();

      // Probable Cause & Root Cause
      expect(screen.getByText('Probable Root Cause & Physical Mechanism')).toBeInTheDocument();
      expect(screen.getByText(/Localized tree foliage overgrowth/i)).toBeInTheDocument();

      // Comparative Behavior
      expect(screen.getByText('Measured vs Expected Physical Behavior')).toBeInTheDocument();
      expect(screen.getByText('Active AC Power')).toBeInTheDocument();
      expect(screen.getAllByText(/3.45 kW/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/5.20 kW/i)[0]).toBeInTheDocument();

      // Losses & Impact
      expect(screen.getByText('Estimated Energy & Financial Impact Quantification')).toBeInTheDocument();
      expect(screen.getByText('Daily Generation Deficit')).toBeInTheDocument();

      // Checklist & History
      expect(screen.getByText('Recommended Field Inspection Checklist')).toBeInTheDocument();
      expect(screen.getByText(/Diagnosis Incident Lifecycle & Audit Trail/i)).toBeInTheDocument();
    });

    unmount();
  });

  it('renders deterministic rule diagnosis without showing probabilistic confidence score (DIAG-403)', async () => {
    const { unmount } = renderDiagnosisDetailPage('DIAG-403');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Fault Diagnosis Dossier: DIAG-403/i })).toBeInTheDocument();
      expect(screen.getAllByText(/Distribution Grid High Voltage Anti-Islanding Trip/i)[0]).toBeInTheDocument();

      // Deterministic badge and description
      expect(screen.getAllByText('Deterministic Rule')[0]).toBeInTheDocument();
      expect(screen.getByText(/Deterministic Hard-Coded Electrical Rule Check/i)).toBeInTheDocument();
      expect(screen.queryByText(/% Match/i)).not.toBeInTheDocument();

      // Sensor readings
      expect(screen.getAllByText(/254.2/i)[0]).toBeInTheDocument();
    });

    unmount();
  });

  it('renders heuristic suspicion diagnosis with unconfirmed warning badge (DIAG-404)', async () => {
    const { unmount } = renderDiagnosisDetailPage('DIAG-404');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Fault Diagnosis Dossier: DIAG-404/i })).toBeInTheDocument();
      expect(screen.getAllByText(/IGBT Thermal Throttling Suspicion/i)[0]).toBeInTheDocument();
      expect(screen.getByText(/Physical Heuristic Suspicion \(Unconfirmed\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Ambient temperature probe uncalibrated/i)).toBeInTheDocument();
    });

    unmount();
  });

  it('renders insufficient evidence state with prominent warning banner and missing data indicators (DIAG-405)', async () => {
    const { unmount } = renderDiagnosisDetailPage('DIAG-405');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Fault Diagnosis Dossier: DIAG-405/i })).toBeInTheDocument();
      expect(screen.getByText(/INSUFFICIENT TELEMETRY EVIDENCE FOR CONCLUSIVE CONFIRMATION/i)).toBeInTheDocument();
      expect(screen.getAllByText('Insufficient Telemetry')[0]).toBeInTheDocument();
      expect(screen.getByText(/CRITICAL DATA WARNING: Stale telemetry gateway stream/i)).toBeInTheDocument();
    });

    unmount();
  });

  it('supports updating diagnosis lifecycle status', async () => {
    const { unmount } = renderDiagnosisDetailPage('DIAG-401');

    await waitFor(() => {
      expect(screen.getAllByText('ACTIVE')[0]).toBeInTheDocument();
    });

    const statusSelect = screen.getByDisplayValue('Active Anomaly');
    fireEvent.change(statusSelect, { target: { value: 'RESOLVED' } });

    await waitFor(() => {
      expect(screen.getByText(/Diagnosis status updated to RESOLVED/i)).toBeInTheDocument();
    });

    unmount();
  });

  it('displays error state when diagnosis ID is invalid', async () => {
    const { unmount } = renderDiagnosisDetailPage('DIAG-INVALID');

    await waitFor(() => {
      expect(screen.getByText('Diagnosis Record Error')).toBeInTheDocument();
      expect(screen.getByText(/Diagnosis record with ID "DIAG-INVALID" was not found/i)).toBeInTheDocument();
    });

    unmount();
  });
});
