import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SolarProvider } from '../context/SolarContext';
import { ToastProvider } from '../components/common/Toast';
import { AuthProvider } from '../context/AuthContext';
import authService from '../services/authService';
import AppRoutes from '../routes/AppRoutes';

const renderWithRouter = (initialRoute = '/') => {
  return render(
    <AuthProvider>
      <SolarProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[initialRoute]}>
            <AppRoutes />
          </MemoryRouter>
        </ToastProvider>
      </SolarProvider>
    </AuthProvider>
  );
};

describe('SolarMind Route Navigation Suite', () => {
  beforeEach(() => {
    sessionStorage.setItem(
      'solarmind_user_session',
      JSON.stringify({ id: 1, full_name: 'Solar Operator', role: 'admin' })
    );
  });
  it('redirects from / to /dashboard and renders Dashboard', async () => {
    renderWithRouter('/');
    await waitFor(() => {
      expect(screen.getByText('Current Generation')).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('renders /dashboard directly', async () => {
    renderWithRouter('/dashboard');
    await waitFor(() => {
      expect(screen.getByText('Energy Generated Today')).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('renders /plants list and /plants/1 detail page', async () => {
    const { unmount } = renderWithRouter('/plants');
    await waitFor(() => {
      expect(screen.getByText('Solar Generation Plants')).toBeInTheDocument();
    }, { timeout: 4000 });
    unmount();

    renderWithRouter('/plants/1');
    await waitFor(() => {
      expect(screen.getByText('Installation Blueprint & Electrical Topology')).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('renders /inverters list and /inverters/INV-101 detail page', async () => {
    const { unmount } = renderWithRouter('/inverters');
    await waitFor(() => {
      expect(screen.getByText(/Inverters Fleet/i)).toBeInTheDocument();
    }, { timeout: 4000 });
    unmount();

    renderWithRouter('/inverters/INV-101');
    await waitFor(() => {
      expect(screen.getByText('High-Resolution Telemetry & Dynamic Operating Curves')).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('renders /monitoring page', async () => {
    renderWithRouter('/monitoring');
    await waitFor(() => {
      expect(screen.getByText('Live Solar Telemetry & Generation Curves')).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('renders /diagnosis and /diagnosis/DIAG-401 detail page', async () => {
    const { unmount } = renderWithRouter('/diagnosis');
    await waitFor(() => {
      expect(screen.getByText('AI Fault Diagnosis Engine')).toBeInTheDocument();
    }, { timeout: 4000 });
    unmount();

    renderWithRouter('/diagnosis/DIAG-401');
    await waitFor(() => {
      expect(screen.getByText(/Fault Diagnosis Dossier: DIAG-401/i)).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('renders /geo-photo photo inspection page', async () => {
    renderWithRouter('/geo-photo');
    await waitFor(() => {
      expect(screen.getByText('Geo-Tagged Photo Inspection & Computer Vision')).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('renders /analytics fleet analytics page', async () => {
    renderWithRouter('/analytics');
    await waitFor(() => {
      expect(screen.getByText('Solar Fleet Performance & Degradation Analytics')).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('renders /work-orders and /work-orders/WO-801 detail page', async () => {
    const { unmount } = renderWithRouter('/work-orders');
    await waitFor(() => {
      expect(screen.getByText('Maintenance Work Orders')).toBeInTheDocument();
    }, { timeout: 4000 });
    unmount();

    renderWithRouter('/work-orders/WO-801');
    await waitFor(() => {
      expect(screen.getByText('Technician Assignment & Action Checklist')).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('renders /maintenance logs page', async () => {
    renderWithRouter('/maintenance');
    await waitFor(() => {
      expect(screen.getByText(/Preventive Maintenance/i)).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('renders /alerts system alerts page', async () => {
    renderWithRouter('/alerts');
    await waitFor(() => {
      expect(screen.getByText('System Alarms & Diagnostic Alerts')).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('renders /settings page', async () => {
    renderWithRouter('/settings');
    await waitFor(() => {
      expect(screen.getByText(/Plant & Application Settings/i)).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('renders /login authentication page', async () => {
    authService.logout();
    const { unmount } = renderWithRouter('/login');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Sign in to SolarMind/i })).toBeInTheDocument();
    });
    unmount();
  });

  it('renders /register authentication page', async () => {
    authService.logout();
    const { unmount } = renderWithRouter('/register');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Create SolarMind Account/i })).toBeInTheDocument();
    });
    unmount();
  });

  it('renders /forgot-password authentication page', async () => {
    authService.logout();
    const { unmount } = renderWithRouter('/forgot-password');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Reset Your Password/i })).toBeInTheDocument();
    });
    unmount();
  });

  it('renders /reset-password authentication page', async () => {
    authService.logout();
    const { unmount } = renderWithRouter('/reset-password?token=test-token-123');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Set New Password/i })).toBeInTheDocument();
    });
    unmount();
  });

  it('renders /verify-email authentication page', async () => {
    authService.logout();
    const { unmount } = renderWithRouter('/verify-email?token=valid-token-123');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Email Verified/i })).toBeInTheDocument();
    });
    unmount();
  });

  it('renders /unauthorized page', async () => {
    authService.logout();
    const { unmount } = renderWithRouter('/unauthorized');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Access Restricted/i })).toBeInTheDocument();
    });
    unmount();
  });

  it('renders 404 NotFoundPage for unknown routes', async () => {
    renderWithRouter('/unknown-solar-route-404');
    await waitFor(() => {
      expect(screen.getByText('Page Not Found')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Return to Overview/i })).toBeInTheDocument();
    }, { timeout: 4000 });
  });
});
