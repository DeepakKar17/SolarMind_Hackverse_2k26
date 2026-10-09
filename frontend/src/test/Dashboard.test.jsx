import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SolarProvider } from '../context/SolarContext';
import { ToastProvider } from '../components/common/Toast';
import { BrowserRouter } from 'react-router-dom';
import DashboardPage from '../pages/DashboardPage';

const renderDashboard = () => {
  return render(
    <SolarProvider>
      <ToastProvider>
        <BrowserRouter>
          <DashboardPage />
        </BrowserRouter>
      </ToastProvider>
    </SolarProvider>
  );
};

describe('SolarMind Dashboard Component Suite', () => {
  it('renders the Dashboard Header with plant metadata and explicit demo indicator', () => {
    renderDashboard();

    expect(screen.getByLabelText(/Selected Plant:/i)).toBeInTheDocument();
    expect(screen.getByText(/DEMO SIMULATION/i)).toBeInTheDocument();
    expect(screen.getByText(/Bengaluru, Karnataka, India/i)).toBeInTheDocument();
    expect(screen.getByText(/Single-String Inverter On-Grid PV/i)).toBeInTheDocument();
    expect(screen.getAllByText(/5.4 kWp/i).length).toBeGreaterThan(0);
  });

  it('renders all 8 summary KPI cards with correct metric units and labels', () => {
    renderDashboard();

    expect(screen.getByText('Current Generation')).toBeInTheDocument();
    expect(screen.getByText('Energy Generated Today')).toBeInTheDocument();
    expect(screen.getByText('Expected vs Actual')).toBeInTheDocument();
    expect(screen.getByText('Performance Ratio (PR)')).toBeInTheDocument();
    expect(screen.getByText('Estimated Energy Loss')).toBeInTheDocument();
    expect(screen.getByText('Estimated Financial Loss')).toBeInTheDocument();
    expect(screen.getByText('Active Fault Alerts')).toBeInTheDocument();
    expect(screen.getByText('Open Work Orders')).toBeInTheDocument();

    // Verify presence of ₹ currency symbols and unit strings
    expect(screen.getAllByText(/₹/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/kWh/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/kW/i).length).toBeGreaterThan(0);
  });

  it('renders chart section titles and visual panels', () => {
    renderDashboard();

    expect(screen.getByText('1. Actual Generation Profile (Today)')).toBeInTheDocument();
    expect(screen.getByText('2. Expected vs. Actual Generation')).toBeInTheDocument();
    expect(screen.getByText('3. Fault Categories by Occurrence')).toBeInTheDocument();
    expect(screen.getByText('4. Energy Loss Trend & Monetary Impact')).toBeInTheDocument();
    expect(screen.getByText('5. Plant Performance Comparison')).toBeInTheDocument();
  });

  it('switches between Alerts, Diagnoses, and Work Orders tabs', async () => {
    const user = userEvent.setup();
    renderDashboard();

    // Default Alerts Tab
    expect(screen.getByText(/Afternoon DC String Shading Anomaly/i)).toBeInTheDocument();

    // Switch to Diagnoses Tab
    const diagBtn = screen.getByRole('button', { name: /Recent Diagnoses/i });
    await user.click(diagBtn);
    expect(screen.getByText(/DIAG-401/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Confidence/i)).toBeInTheDocument();

    // Switch to Work Orders Tab
    const woBtn = screen.getByRole('button', { name: /Work Orders/i });
    await user.click(woBtn);
    expect(screen.getByText(/WO-801/i)).toBeInTheDocument();
    expect(screen.getByText(/Trim Rooftop Tree Branches/i)).toBeInTheDocument();
  });

  it('filters table rows when search input is typed', async () => {
    const user = userEvent.setup();
    renderDashboard();

    const searchInput = screen.getByPlaceholderText(/Search alerts.../i);
    await user.type(searchInput, 'Soiling');

    expect(screen.getByText(/Uniform Panel Dust & Soiling Deposition/i)).toBeInTheDocument();
    expect(screen.queryByText(/Afternoon DC String Shading Anomaly/i)).not.toBeInTheDocument();
  });
});
