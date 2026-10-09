import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SolarProvider } from '../context/SolarContext';
import { ToastProvider } from '../components/common/Toast';
import GeoPhotoPage from '../pages/GeoPhotoPage';
import { photoService } from '../services/photoService';

const renderGeoPhotoPage = () => {
  return render(
    <SolarProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={['/geo-photo']}>
          <GeoPhotoPage />
        </MemoryRouter>
      </ToastProvider>
    </SolarProvider>
  );
};

describe('GeoPhotoPage Component Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders photo upload UI, metric cards, and idle state', async () => {
    const { unmount } = renderGeoPhotoPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Geo-Tagged Photo Inspection & Computer Vision/i })).toBeInTheDocument();
      expect(screen.getByText('CV Inference Engine')).toBeInTheDocument();
      expect(screen.getByText('Defect Detection Classes')).toBeInTheDocument();
      expect(screen.getByText('Click to select or drag & drop array photo')).toBeInTheDocument();
      expect(screen.getByText('No Inspection Image Analyzed')).toBeInTheDocument();
    });

    unmount();
  });

  it('handles image selection, manual GPS coordinates, and runs CV defect analysis', async () => {
    const { unmount } = renderGeoPhotoPage();

    await waitFor(() => {
      expect(screen.getByText('Click to select or drag & drop array photo')).toBeInTheDocument();
    });

    // Simulate file input change
    const file = new File(['fake-image-content'], 'solar-hotspot-cell.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]');
    
    // Trigger file select
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getAllByText('solar-hotspot-cell.jpg')[0]).toBeInTheDocument();
    });

    // Switch to manual GPS mode
    const manualGpsBtn = screen.getByRole('button', { name: /Manual Coordinates/i });
    fireEvent.click(manualGpsBtn);

    expect(screen.getByLabelText(/Latitude/i)).toBeInTheDocument();

    // Trigger analysis
    const scanBtn = screen.getByRole('button', { name: /Execute CV Defect Scan/i });
    fireEvent.click(scanBtn);

    await waitFor(() => {
      expect(screen.getByText('Computer Vision Defect Analysis Dossier')).toBeInTheDocument();
      expect(screen.getByText(/Localized Thermal Hotspot/i)).toBeInTheDocument();
      expect(screen.getByText(/Bypass diode continuity test/i)).toBeInTheDocument();
    }, { timeout: 4000 });

    unmount();
  });

  it('renders model not_configured banner when vision model is disabled', async () => {
    const { unmount } = renderGeoPhotoPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Geo-Tagged Photo Inspection/i })).toBeInTheDocument();
    });

    // Toggle vision model to OFF (simulate not configured)
    const toggleBtn = screen.getByRole('button', { name: /Vision Model:/i });
    fireEvent.click(toggleBtn);

    // Select file and click analyze
    const file = new File(['fake-data'], 'test-panel.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getAllByText('test-panel.jpg')[0]).toBeInTheDocument();
    });

    const scanBtn = screen.getByRole('button', { name: /Execute CV Defect Scan/i });
    fireEvent.click(scanBtn);

    await waitFor(() => {
      expect(screen.getByText('Computer Vision Model Service Not Configured')).toBeInTheDocument();
      expect(screen.getByText(/No active neural inference worker is configured/i)).toBeInTheDocument();
    });

    unmount();
  });
});
