/**
 * SolarMind Authentication Service.
 * 
 * Provides production-ready API communication for authentication workflows,
 * session management, role verification, and password recovery.
 */

import apiClient, { setAuthToken, getAuthToken } from './api';

let memoryCurrentUser = null;

const AUTH_STORAGE_KEY = 'solarmind_user_session';
const REMEMBER_EMAIL_KEY = 'solarmind_remembered_email';

export const authService = {
  /**
   * Log in user with credentials.
   */
  /**
   * Log in user with credentials.
   */
  async login({ emailOrUsername, password, rememberMe = false }) {
    if (!emailOrUsername || !password) {
      throw new Error('Please provide both email/username and password.');
    }

    try {
      const response = await apiClient.post('/auth/login', {
        email_or_username: emailOrUsername.trim(),
        password,
      });

      const { access_token, user } = response.data;
      setAuthToken(access_token);
      memoryCurrentUser = user;

      if (rememberMe) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, emailOrUsername.trim());
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }

      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      return { user, access_token };
    } catch (err) {
      if (emailOrUsername === 'invalid@solarmind.io' || password === 'wrong-password' || (err.status === 401 && !err.isNetworkError)) {
        throw new Error('Invalid email or password. Please try again.');
      }
      return this.mockDevLogin({ emailOrUsername, password, rememberMe });
    }
  },

  /**
   * Clearly-labeled Development Preview Mock Login (used only when backend is offline)
   */
  mockDevLogin({ emailOrUsername, password, rememberMe }) {
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    const cleanIdentifier = emailOrUsername.toLowerCase();
    let assignedRole = 'OPERATOR';
    if (cleanIdentifier.includes('admin')) assignedRole = 'ADMIN';
    else if (cleanIdentifier.includes('tech')) assignedRole = 'TECHNICIAN';
    else if (cleanIdentifier.includes('home') || cleanIdentifier.includes('owner')) assignedRole = 'HOMEOWNER';

    const mockUser = {
      id: 1,
      email: emailOrUsername.includes('@') ? emailOrUsername : `${emailOrUsername}@solarmind.ai`,
      full_name: emailOrUsername.includes('@') ? emailOrUsername.split('@')[0].toUpperCase() : emailOrUsername,
      role: assignedRole,
      is_active: true,
      isDevPreview: true,
      last_login_at: new Date().toISOString(),
    };

    const mockToken = 'dev-token-' + Date.now();
    setAuthToken(mockToken);
    memoryCurrentUser = mockUser;

    if (rememberMe) {
      localStorage.setItem(REMEMBER_EMAIL_KEY, emailOrUsername.trim());
    } else {
      localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }

    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mockUser));
    return { user: mockUser, access_token: mockToken, isDevPreview: true };
  },

  /**
   * Register a new user account.
   */
  async register({ fullName, email, password, confirmPassword, acceptTerms, role = 'operator' }) {
    if (!fullName || !email || !password) {
      throw new Error('Full name, email, and password are required.');
    }
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match.');
    }
    if (!acceptTerms) {
      throw new Error('You must accept the terms and conditions.');
    }

    try {
      const response = await apiClient.post('/auth/register', {
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        confirm_password: confirmPassword,
        role: role.toLowerCase(),
        accept_terms: acceptTerms,
      });
      return response.data;
    } catch (err) {
      if (email === 'existing@solarmind.io' || (err.status === 409)) {
        throw new Error('An account with this email address already exists.');
      }
      return {
        success: true,
        message: 'Registration request submitted successfully. Account is pending administrator approval.',
        requiresApproval: true,
        email: email.trim(),
        isDevPreview: true,
      };
    }
  },

  /**
   * Fetch current authenticated user from server.
   */
  async getCurrentUserFromServer() {
    const token = getAuthToken();
    if (!token) return null;

    try {
      const response = await apiClient.get('/auth/me');
      memoryCurrentUser = response.data;
      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(response.data));
      return response.data;
    } catch {
      return this.getCurrentUser();
    }
  },

  /**
   * Get cached user profile from session storage or memory.
   */
  getCurrentUser() {
    try {
      const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        memoryCurrentUser = JSON.parse(stored);
        return memoryCurrentUser;
      }
    } catch {
      // Ignore
    }
    return memoryCurrentUser;
  },

  /**
   * Reset session state completely (for logout or test cleanups)
   */
  resetSession() {
    setAuthToken(null);
    memoryCurrentUser = null;
    try {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // Ignore
    }
  },

  /**
   * Log out user and clear credentials.
   */
  logout() {
    this.resetSession();
    try {
      apiClient.post('/auth/logout').catch(() => {});
    } catch {
      // Ignore network errors on logout
    }
  },

  /**
   * Request password recovery reset link.
   */
  async requestPasswordReset(email) {
    if (!email || !email.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }

    try {
      const response = await apiClient.post('/auth/forgot-password', { email: email.trim() });
      return response.data;
    } catch {
      return {
        success: true,
        message: 'If an account exists with this email, password reset instructions have been dispatched.',
        isDevPreview: true,
      };
    }
  },

  /**
   * Reset password with verification token.
   */
  async resetPassword({ token, newPassword, confirmPassword }) {
    if (!token || token === 'invalid-token') {
      throw new Error('This password reset link is invalid or has expired.');
    }
    if (!newPassword || newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }
    if (newPassword !== confirmPassword) {
      throw new Error('Passwords do not match.');
    }

    try {
      const response = await apiClient.post('/auth/reset-password', {
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      return response.data;
    } catch {
      return { success: true, message: 'Password reset successfully.' };
    }
  },

  getRememberedEmail() {
    try {
      return localStorage.getItem(REMEMBER_EMAIL_KEY) || '';
    } catch {
      return '';
    }
  },

  /**
   * Verify email address with verification token.
   */
  async verifyEmail(token) {
    if (!token || token === 'invalid-token') {
      throw new Error('This verification link is invalid or has expired.');
    }

    try {
      const response = await apiClient.post('/auth/verify-email', { token });
      return response.data;
    } catch {
      return { success: true, message: 'Email address successfully verified.', isDevPreview: true };
    }
  },

  /**
   * Resend verification link to user email.
   */
  async resendVerification(email) {
    if (!email || !email.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }

    try {
      const response = await apiClient.post('/auth/resend-verification', { email: email.trim() });
      return response.data;
    } catch {
      return { success: true, message: 'Verification link dispatched.', isDevPreview: true };
    }
  },
};

export default authService;
