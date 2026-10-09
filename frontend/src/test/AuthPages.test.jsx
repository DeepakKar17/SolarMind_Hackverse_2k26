import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';
import VerifyEmailPage from '../pages/auth/VerifyEmailPage';
import UnauthorizedPage from '../pages/auth/UnauthorizedPage';
import authService from '../services/authService';

describe('SolarMind Authentication System Suite', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    authService.logout();
    vi.clearAllMocks();
  });

  const renderWithAuth = (ui, { route = '/' } = {}) => {
    return render(
      <AuthProvider>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/" element={ui} />
            <Route path="/dashboard" element={<div>Mock Dashboard</div>} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );
  };

  // ---------------------------------------------------------------------------
  // 1. LoginPage Tests
  // ---------------------------------------------------------------------------
  describe('LoginPage Component', () => {
    it('renders login fields, remember-me checkbox, and quick fill button', () => {
      renderWithAuth(<LoginPage />);

      expect(screen.getByLabelText(/Email address or Username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Remember my email/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sign In to Dashboard/i })).toBeInTheDocument();
      expect(screen.getByText(/Forgot password\?/i)).toBeInTheDocument();
      expect(screen.getByText(/Quick Fill Demo/i)).toBeInTheDocument();
    });

    it('toggles password visibility when clicking eye button', () => {
      renderWithAuth(<LoginPage />);

      const passwordInput = screen.getByLabelText(/^Password/i);
      const toggleBtn = screen.getByRole('button', { name: /Show password/i });

      expect(passwordInput).toHaveAttribute('type', 'password');
      fireEvent.click(toggleBtn);
      expect(passwordInput).toHaveAttribute('type', 'text');
      expect(screen.getByRole('button', { name: /Hide password/i })).toBeInTheDocument();
    });

    it('populates fields when clicking Quick Fill Demo', () => {
      renderWithAuth(<LoginPage />);

      const quickFillBtn = screen.getByText(/Quick Fill Demo/i);
      fireEvent.click(quickFillBtn);

      expect(screen.getByLabelText(/Email address or Username/i)).toHaveValue('operator@solarmind.io');
      expect(screen.getByLabelText(/^Password/i)).toHaveValue('SolarMind2026!');
    });

    it('validates required fields on empty submit', async () => {
      renderWithAuth(<LoginPage />);

      const submitBtn = screen.getByRole('button', { name: /Sign In to Dashboard/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Please enter your email address or username/i)).toBeInTheDocument();
        expect(screen.getByText(/Please enter your password/i)).toBeInTheDocument();
      });
    });

    it('submits valid credentials and logs in user', async () => {
      renderWithAuth(<LoginPage />);

      fireEvent.click(screen.getByText(/Quick Fill Demo/i));
      fireEvent.click(screen.getByRole('button', { name: /Sign In to Dashboard/i }));

      await waitFor(() => {
        expect(screen.getByText('Mock Dashboard')).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 2. RegisterPage Tests
  // ---------------------------------------------------------------------------
  describe('RegisterPage Component', () => {
    it('renders registration form and approval notice', () => {
      renderWithAuth(<RegisterPage />);

      expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Work Email Address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/I agree to the SolarMind/i)).toBeInTheDocument();
      expect(screen.getByText(/New accounts require administrative approval/i)).toBeInTheDocument();
    });

    it('validates password mismatch and unaccepted terms', async () => {
      renderWithAuth(<RegisterPage />);

      fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Jane Doe' } });
      fireEvent.change(screen.getByLabelText(/Work Email Address/i), { target: { value: 'jane@solarmind.io' } });
      fireEvent.change(screen.getByLabelText(/Password \(min 8 characters\)/i), { target: { value: 'Password123!' } });
      fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'DifferentPassword123!' } });

      fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

      await waitFor(() => {
        expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
        expect(screen.getByText(/You must accept the terms of service/i)).toBeInTheDocument();
      });
    });

    it('shows approval confirmation screen on successful submission', async () => {
      renderWithAuth(<RegisterPage />);

      fireEvent.click(screen.getByText(/Quick Fill Demo/i));
      fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

      await waitFor(() => {
        expect(screen.getByText(/Registration Submitted/i)).toBeInTheDocument();
        expect(screen.getByText(/Account approval is pending verification/i)).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 3. ForgotPasswordPage Tests
  // ---------------------------------------------------------------------------
  describe('ForgotPasswordPage Component', () => {
    it('renders recovery request form and privacy notice', () => {
      renderWithAuth(<ForgotPasswordPage />);

      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Send Password Reset Link/i })).toBeInTheDocument();
    });

    it('displays neutral confirmation and privacy notice on submit', async () => {
      renderWithAuth(<ForgotPasswordPage />);

      fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'test@solarmind.io' } });
      fireEvent.click(screen.getByRole('button', { name: /Send Password Reset Link/i }));

      await waitFor(() => {
        expect(screen.getByText(/Check Your Email/i)).toBeInTheDocument();
        expect(screen.getByText(/SolarMind does not disclose whether a requested email is registered/i)).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 4. ResetPasswordPage Tests
  // ---------------------------------------------------------------------------
  describe('ResetPasswordPage Component', () => {
    it('renders error when token is missing', () => {
      renderWithAuth(<ResetPasswordPage />, { route: '/reset-password' });

      expect(screen.getByText(/Invalid Reset Link/i)).toBeInTheDocument();
      expect(screen.getByText(/missing a valid security token/i)).toBeInTheDocument();
    });

    it('renders new password form when token is present and updates password', async () => {
      renderWithAuth(<ResetPasswordPage />, { route: '/reset-password?token=sample-reset-token-123' });

      expect(screen.getByText(/Set New Password/i)).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/^New Password/i), { target: { value: 'NewSecurePassword123!' } });
      fireEvent.change(screen.getByLabelText(/Confirm New Password/i), { target: { value: 'NewSecurePassword123!' } });

      fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));

      await waitFor(() => {
        expect(screen.getByText(/Password Updated/i)).toBeInTheDocument();
        expect(screen.getByText(/Sign In Now/i)).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 5. VerifyEmailPage Tests
  // ---------------------------------------------------------------------------
  describe('VerifyEmailPage Component', () => {
    it('shows error state when token is missing', () => {
      renderWithAuth(<VerifyEmailPage />, { route: '/verify-email' });

      expect(screen.getByText(/Verification Failed/i)).toBeInTheDocument();
      expect(screen.getByText(/Verification token is missing/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Resend Verification Email/i })).toBeInTheDocument();
    });

    it('shows verified state when valid token is supplied', async () => {
      renderWithAuth(<VerifyEmailPage />, { route: '/verify-email?token=valid-email-token-123' });

      await waitFor(() => {
        expect(screen.getByText(/Email Verified/i)).toBeInTheDocument();
        expect(screen.getByText(/Your account is now verified and active/i)).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 6. UnauthorizedPage Tests
  // ---------------------------------------------------------------------------
  describe('UnauthorizedPage Component', () => {
    it('renders 403 Forbidden status and role permissions guide', () => {
      renderWithAuth(<UnauthorizedPage />);

      expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
      expect(screen.getByText(/403 Forbidden — Insufficient Permissions/i)).toBeInTheDocument();
      expect(screen.getByText(/Role Permissions Overview:/i)).toBeInTheDocument();
      expect(screen.getByText(/VIEWER:/i)).toBeInTheDocument();
      expect(screen.getByText(/OPERATOR:/i)).toBeInTheDocument();
      expect(screen.getByText(/TECHNICIAN:/i)).toBeInTheDocument();
      expect(screen.getByText(/ADMINISTRATOR:/i)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 7. authService Unit Tests
  // ---------------------------------------------------------------------------
  describe('authService Module', () => {
    it('stores remembered email when rememberMe is checked', async () => {
      await authService.login({
        emailOrUsername: 'tech@solarmind.io',
        password: 'Password123!',
        rememberMe: true,
      });

      expect(authService.getRememberedEmail()).toBe('tech@solarmind.io');
    });

    it('clears session memory on logout', () => {
      authService.mockDevLogin({ emailOrUsername: 'admin@solarmind.io', password: 'Password123!' });
      expect(authService.getCurrentUser()).not.toBeNull();

      authService.logout();
      expect(authService.getCurrentUser()).toBeNull();
    });
  });
});
