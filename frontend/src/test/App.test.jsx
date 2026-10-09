import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';

describe('SolarMind Application Root', () => {
  beforeEach(() => {
    sessionStorage.setItem(
      'solarmind_user_session',
      JSON.stringify({ id: 1, full_name: 'Solar Operator', role: 'admin' })
    );
  });
  it('renders the SolarMind brand title and Pro badge', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getAllByText(/SolarMind/i).length).toBeGreaterThan(0);
      expect(screen.getByText('PRO')).toBeInTheDocument();
    });
  });

  it('renders navigation links in the sidebar', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Fault Diagnoses/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Design System UI/i })).toBeInTheDocument();
    });
  });

  it('loads the Dashboard view with KPI metrics', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Current Generation')).toBeInTheDocument();
      expect(screen.getByText('Energy Generated Today')).toBeInTheDocument();
    });
  });
});
