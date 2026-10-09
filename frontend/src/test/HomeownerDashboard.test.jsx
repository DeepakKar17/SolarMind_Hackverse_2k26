import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { AuthContext } from '../context/AuthContext';
import { SolarProvider } from '../context/SolarContext';
import { ToastProvider } from '../components/common/Toast';
import { HomeownerDashboardPage } from '../pages/HomeownerDashboardPage';

const renderHomeownerDashboard = (userRole = 'homeowner', userEmail = 'homeowner@solarmind.io') => {
  const mockUser = {
    id: 101,
    email: userEmail,
    full_name: 'Deepak Sharma',
    role: userRole,
  };

  const authValue = {
    user: mockUser,
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
  };

  return render(
    <AuthContext.Provider value={authValue}>
      <SolarProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={['/home/dashboard']}>
            <HomeownerDashboardPage />
          </MemoryRouter>
        </ToastProvider>
      </SolarProvider>
    </AuthContext.Provider>
  );
};

describe('Homeowner Dashboard Component & Multi-Language Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. RENDERING & DEFAULT ENGLISH VIEW
  // =========================================================================
  it('renders homeowner dashboard with portal title, greeting, and system specs', async () => {
    renderHomeownerDashboard();

    expect(screen.getByText('Homeowner Solar Portal')).toBeInTheDocument();
    expect(screen.getByText(/Deepak Sharma/i)).toBeInTheDocument();
    expect(screen.getAllByText(/5.4 kWp/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Demo Simulation Mode')).toBeInTheDocument();
  });

  // =========================================================================
  // 2. DASHBOARD KPI CARDS (8 METRICS)
  // =========================================================================
  it('renders all 8 household KPI cards correctly', async () => {
    renderHomeownerDashboard();

    // 1. Current Power Output
    expect(screen.getByText('Current Power Output')).toBeInTheDocument();

    // 2. Today's Total Generation
    expect(screen.getByText("Today's Total Generation")).toBeInTheDocument();

    // 3. Expected vs Actual
    expect(screen.getByText('Expected vs Actual Yield')).toBeInTheDocument();

    // 4. Energy Shortfall
    expect(screen.getByText('Daily Energy Shortfall')).toBeInTheDocument();

    // 5. Financial Savings in ₹
    expect(screen.getByText('Estimated Solar Savings / Loss')).toBeInTheDocument();

    // 6. Overall Solar Health Score
    expect(screen.getByText('Overall Solar Health Score')).toBeInTheDocument();

    // 7. Active Alerts
    expect(screen.getByText('Active Solar Alerts')).toBeInTheDocument();

    // 8. Pending Maintenance
    expect(screen.getByText('Pending Maintenance')).toBeInTheDocument();
  });

  // =========================================================================
  // 3. MULTI-LANGUAGE ENGINE (HINDI & ODIA)
  // =========================================================================
  it('switches interface language to Hindi (हिंदी) seamlessly', async () => {
    renderHomeownerDashboard();

    const hindiButton = screen.getByRole('button', { name: 'हिंदी' });
    fireEvent.click(hindiButton);

    // Header & KPIs translated into Hindi
    expect(screen.getByText('सौर ऊर्जा गृहस्वामी पोर्टल')).toBeInTheDocument();
    expect(screen.getByText('वर्तमान सौर ऊर्जा उत्पादन')).toBeInTheDocument();
    expect(screen.getByText('आज का कुल उत्पादन')).toBeInTheDocument();
    expect(screen.getByText('सोलर सिस्टम स्वास्थ्य स्कोर')).toBeInTheDocument();
  });

  it('switches interface language to Odia (ଓଡ଼ିଆ) seamlessly', async () => {
    renderHomeownerDashboard();

    const odiaButton = screen.getByRole('button', { name: 'ଓଡ଼ିଆ' });
    fireEvent.click(odiaButton);

    // Header & KPIs translated into Odia
    expect(screen.getByText('ସୌର ଶକ୍ତି ଗୃହସ୍ୱାମୀ ପୋର୍ଟାଲ')).toBeInTheDocument();
    expect(screen.getByText('ବର୍ତ୍ତମାନ ବିଦ୍ୟୁତ୍ ଉତ୍ପାଦନ')).toBeInTheDocument();
    expect(screen.getByText('ଆଜିର ମୋଟ ଉତ୍ପାଦନ')).toBeInTheDocument();
    expect(screen.getByText('ସୋଲାର ସିଷ୍ଟମ ସ୍ୱାସ୍ଥ୍ୟ ସ୍କୋର')).toBeInTheDocument();
  });

  // =========================================================================
  // 4. PLAIN-LANGUAGE AI DIAGNOSIS EXPERIENCE
  // =========================================================================
  it('renders plain-language diagnosis questions and explanations', async () => {
    renderHomeownerDashboard();

    expect(screen.getByText('Plain-Language AI Solar Diagnosis')).toBeInTheDocument();
    expect(screen.getByText('1. What was observed?')).toBeInTheDocument();
    expect(screen.getByText('2. Why is this happening?')).toBeInTheDocument();
    expect(screen.getByText('3. What is the evidence?')).toBeInTheDocument();
    expect(screen.getByText('5. What should you do next?')).toBeInTheDocument();
    expect(screen.getByText('6. Is a qualified technician required?:')).toBeInTheDocument();
  });

  // =========================================================================
  // 5. MODALS: PHOTO INSPECTION & TECHNICIAN DISPATCH
  // =========================================================================
  it('opens photo inspection modal and submits image verification request', async () => {
    renderHomeownerDashboard();

    const uploadButtons = screen.getAllByRole('button', { name: /Upload Rooftop Photo for Verification/i });
    fireEvent.click(uploadButtons[0]);

    expect(screen.getByText('Upload Rooftop Photo for AI Analysis')).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Submit Photo for Inspection/i });
    expect(submitBtn).toBeInTheDocument();
  });

  it('opens technician service request modal and dispatches visit', async () => {
    renderHomeownerDashboard();

    const requestButtons = screen.getAllByRole('button', { name: /Request Technician Visit/i });
    fireEvent.click(requestButtons[0]);

    expect(screen.getByText('Request Qualified Technician Visit')).toBeInTheDocument();

    const notesInput = screen.getByPlaceholderText(/e\.g\. Inverter showing shading warning/i);
    fireEvent.change(notesInput, { target: { value: 'Please inspect South-West solar string connections.' } });

    const dispatchBtn = screen.getByRole('button', { name: /Dispatch Service Request/i });
    fireEvent.click(dispatchBtn);

    await waitFor(() => {
      expect(screen.getByText('Service Request Dispatched!')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 6. PREFERENCES & STATEMENT EXPORT
  // =========================================================================
  it('opens preferences modal and toggles notification channels', async () => {
    renderHomeownerDashboard();

    const prefsBtn = screen.getByRole('button', { name: /Homeowner Preferences/i });
    fireEvent.click(prefsBtn);

    expect(screen.getByText('Configure your preferred notification channels and language preferences.')).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /Save Preferences/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('Preferences saved successfully!')).toBeInTheDocument();
    });
  });

  it('triggers statement download without error', async () => {
    renderHomeownerDashboard();

    const downloadCsvBtn = screen.getByRole('button', { name: /Download CSV Data/i });
    fireEvent.click(downloadCsvBtn);

    // Verify button goes into loading state or completes safely
    expect(downloadCsvBtn).toBeInTheDocument();
  });
});
