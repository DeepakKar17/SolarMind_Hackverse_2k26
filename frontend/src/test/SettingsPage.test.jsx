import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SolarProvider } from '../context/SolarContext';
import { ToastProvider } from '../components/common/Toast';
import SettingsPage from '../pages/SettingsPage';
import { settingsService } from '../services/settingsService';

const renderSettingsPage = () => {
  return render(
    <SolarProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={['/settings']}>
          <SettingsPage />
        </MemoryRouter>
      </ToastProvider>
    </SolarProvider>
  );
};

describe('SettingsPage Component Suite', () => {
  beforeEach(() => {
    settingsService.resetSettings();
  });

  it('renders settings navigation tabs and plant preferences', async () => {
    const { unmount } = renderSettingsPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Plant & Application Settings/i })).toBeInTheDocument();
      expect(screen.getByText('Plant & Physical Model')).toBeInTheDocument();
      expect(screen.getByText('Display Units & Currency')).toBeInTheDocument();
      expect(screen.getByText('Date, Time & Locale')).toBeInTheDocument();
      expect(screen.getByText('Data Refresh & Polling')).toBeInTheDocument();
      expect(screen.getByText('System Health & Engine Status')).toBeInTheDocument();

      // Form inputs
      expect(screen.getByText('Solar Plant & Physical Model Preferences')).toBeInTheDocument();
      expect(screen.getByLabelText(/Feed-in Tariff Rate/i)).toBeInTheDocument();
    });

    unmount();
  });

  it('switches to System Health status tab and verifies config indicators', async () => {
    const { unmount } = renderSettingsPage();

    await waitFor(() => {
      expect(screen.getByText('System Health & Engine Status')).toBeInTheDocument();
    });

    const statusTabBtn = screen.getByRole('button', { name: /System Health & Engine Status/i });
    fireEvent.click(statusTabBtn);

    await waitFor(() => {
      expect(screen.getByText('SolarMind Core Version')).toBeInTheDocument();
      expect(screen.getByText('FastAPI Backend Status')).toBeInTheDocument();
      expect(screen.getByText('CV Model Engine')).toBeInTheDocument();
      expect(screen.getByText('SQLite 3.x')).toBeInTheDocument();
    });

    unmount();
  });

  it('saves updated settings and shows confirmation feedback', async () => {
    const { unmount } = renderSettingsPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Feed-in Tariff Rate/i)).toBeInTheDocument();
    });

    const tariffInput = screen.getByLabelText(/Feed-in Tariff Rate/i);
    fireEvent.change(tariffInput, { target: { value: '8.25' } });

    const saveBtns = screen.getAllByRole('button', { name: /Save (Preferences|All Preferences)/i });
    fireEvent.click(saveBtns[0]);

    await waitFor(() => {
      expect(screen.getByText(/Application settings and preferences successfully saved/i)).toBeInTheDocument();
    });

    unmount();
  });
});
