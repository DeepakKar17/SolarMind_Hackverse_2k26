import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import AuthCard from '../../components/auth/AuthCard';
import PasswordInput from '../../components/auth/PasswordInput';
import DevPreviewNotice from '../../components/auth/DevPreviewNotice';
import authService from '../../services/authService';

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, devLogin } = useAuth();

  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  // Populate remembered email if saved
  useEffect(() => {
    const savedEmail = authService.getRememberedEmail();
    if (savedEmail) {
      setEmailOrUsername(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const targetPath = location.state?.from?.pathname || '/dashboard';
      navigate(targetPath, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const validate = () => {
    const errors = {};
    if (!emailOrUsername.trim()) {
      errors.emailOrUsername = 'Please enter your email address or username.';
    }
    if (!password) {
      errors.password = 'Please enter your password.';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validate()) {
      return;
    }

    setIsLoading(true);
    try {
      await login({
        emailOrUsername: emailOrUsername.trim(),
        password,
        rememberMe,
      });
      const targetPath = location.state?.from?.pathname || '/dashboard';
      navigate(targetPath, { replace: true });
    } catch (err) {
      setErrorMessage(err.message || 'Invalid credentials. Please verify your email and password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = () => {
    setEmailOrUsername('operator@solarmind.io');
    setPassword('SolarMind2026!');
    setErrorMessage(null);
    setValidationErrors({});
  };

  return (
    <AuthCard
      title="Sign in to SolarMind"
      subtitle="Access your solar plant telemetry, inverter diagnostics, and maintenance dispatch."
      alertMessage={errorMessage}
      alertType="error"
      footer={
        <div>
          Don&apos;t have an account?{' '}
          <Link to="/register" style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)', textDecoration: 'none' }}>
            Register plant operator
          </Link>
        </div>
      }
    >
      <DevPreviewNotice onQuickFill={handleQuickFill} />

      <form onSubmit={handleSubmit} noValidate>
        {/* Email or Username */}
        <div className="sm-form-group" style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="login-email" className="sm-label">
            Email address or Username <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            id="login-email"
            name="emailOrUsername"
            type="text"
            value={emailOrUsername}
            onChange={(e) => {
              setEmailOrUsername(e.target.value);
              if (validationErrors.emailOrUsername) {
                setValidationErrors((prev) => ({ ...prev, emailOrUsername: undefined }));
              }
            }}
            placeholder="operator@solarmind.io"
            required
            autoComplete="username"
            disabled={isLoading}
            className={`sm-input ${validationErrors.emailOrUsername ? 'sm-input--error' : ''}`}
            aria-invalid={Boolean(validationErrors.emailOrUsername)}
          />
          {validationErrors.emailOrUsername && (
            <span role="alert" style={{ display: 'block', marginTop: '4px', fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)' }}>
              {validationErrors.emailOrUsername}
            </span>
          )}
        </div>

        {/* Password */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <PasswordInput
            id="login-password"
            name="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (validationErrors.password) {
                setValidationErrors((prev) => ({ ...prev, password: undefined }));
              }
            }}
            label="Password"
            required
            autoComplete="current-password"
            disabled={isLoading}
            error={validationErrors.password}
          />
        </div>

        {/* Remember Me & Forgot Password */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--space-6)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              id="remember-me"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={isLoading}
              style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
            />
            <span style={{ color: 'var(--color-text-secondary)' }}>Remember my email</span>
          </label>

          <Link
            to="/forgot-password"
            style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 'var(--font-weight-medium)' }}
          >
            Forgot password?
          </Link>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="sm-btn sm-btn--primary"
          style={{ width: '100%', height: '44px', fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)' }}
          disabled={isLoading}
        >
          {isLoading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
              <span className="sm-spinner sm-spinner--sm" />
              <span>Authenticating...</span>
            </span>
          ) : (
            'Sign In to Dashboard'
          )}
        </button>
      </form>
    </AuthCard>
  );
};

export default LoginPage;
