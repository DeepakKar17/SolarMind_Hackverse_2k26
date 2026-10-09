import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SolarProvider } from '../context/SolarContext';
import { ToastProvider } from '../components/common/Toast';
import AnalyticsPage from '../pages/AnalyticsPage';

const renderAnalyticsPage = () => {
  return render(
    <SolarProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={['/analytics']}>
          <AnalyticsPage />
        </MemoryRouter>
      </ToastProvider>
    </SolarProvider>
  );
};

describe('AnalyticsPage Component Suite', () => {
  it('renders analytics header, generation trends, fault category breakdowns, and SLA KPIs', async () => {
    const { unmount } = renderAnalyticsPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Solar Fleet Performance & Degradation Analytics/i })).toBeInTheDocument();
      expect(screen.getByText('Total Harvested Energy')).toBeInTheDocument();
      expect(screen.getByText('Clear-Sky Model Expected')).toBeInTheDocument();
      expect(screen.getByText('Average Performance Ratio (PR)')).toBeInTheDocument();

      // Generation curves & categories
      expect(screen.getByText('Actual vs Clear-Sky Expected Generation Trends')).toBeInTheDocument();
      expect(screen.getByText('Fault Category Loss Contributions')).toBeInTheDocument();
      expect(screen.getByText('Partial Shading')).toBeInTheDocument();
      expect(screen.getByText('Surface Soiling & Dust')).toBeInTheDocument();

      // Maintenance response metrics
      expect(screen.getByText('Maintenance Response & Resolution Metrics')).toBeInTheDocument();
      expect(screen.getByText('Mean Time To Detect (MTTD)')).toBeInTheDocument();
      expect(screen.getByText('Mean Time To Resolve (MTTR)')).toBeInTheDocument();
    });

    unmount();
  });

  it('triggers CSV and JSON report exports', async () => {
    const { unmount } = renderAnalyticsPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Export CSV/i })).toBeInTheDocument();
    });

    const csvBtn = screen.getByRole('button', { name: /Export CSV/i });
    fireEvent.click(csvBtn);

    await waitFor(() => {
      expect(screen.getByText(/Successfully generated and downloaded/i)).toBeInTheDocument();
    });

    unmount();
  });
});
