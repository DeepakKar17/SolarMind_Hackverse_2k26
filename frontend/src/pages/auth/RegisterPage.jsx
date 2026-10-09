import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthCard from '../../components/auth/AuthCard';
import PasswordInput from '../../components/auth/PasswordInput';
import DevPreviewNotice from '../../components/auth/DevPreviewNotice';
import authService from '../../services/authService';

export const RegisterPage = () => {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  const validate = () => {
    const errors = {};
    if (!fullName.trim()) {
      errors.fullName = 'Full name is required.';
    }
    if (!email.trim() || !email.includes('@')) {
      errors.email = 'Please provide a valid email address.';
    }
    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }
    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    if (!acceptTerms) {
      errors.acceptTerms = 'You must accept the terms of service to create an account.';
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
      const result = await authService.register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        acceptTerms,
      });

      setSuccessInfo(result);
    } catch (err) {
      setErrorMessage(err.message || 'Registration failed. Please check your details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = () => {
    setFullName('Rajesh Kumar');
    setEmail('rajesh.kumar@solarmind.io');
    setPassword('SolarPower2026!');
    setConfirmPassword('SolarPower2026!');
    setAcceptTerms(true);
    setValidationErrors({});
    setErrorMessage(null);
  };

  if (successInfo) {
    return (
      <AuthCard
        title="Registration Submitted"
        subtitle="Account approval is pending verification."
        alertMessage={successInfo.message}
        alertType="success"
        footer={
          <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)', textDecoration: 'none' }}>
            Return to Sign In
          </Link>
        }
      >
        <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-4)' }}>📋</div>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            Your registration request for <strong>{email}</strong> has been submitted to your organization&apos;s solar plant administrator. You will receive an activation email once your plant permissions have been authorized.
          </p>
          <div style={{ marginTop: 'var(--space-6)' }}>
            <Link to="/login" className="sm-btn sm-btn--primary" style={{ width: '100%', textDecoration: 'none', display: 'inline-block', textAlign: 'center' }}>
              Proceed to Login
            </Link>
          </div>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create SolarMind Account"
      subtitle="Register as a plant operator, asset manager, or maintenance technician."
      alertMessage={errorMessage}
      alertType="error"
      footer={
        <div>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)', textDecoration: 'none' }}>
            Sign In
          </Link>
        </div>
      }
    >
      <DevPreviewNotice onQuickFill={handleQuickFill} />

      {/* Approval notice banner */}
      <div
        style={{
          padding: 'var(--space-3) var(--space-4)',
          backgroundColor: 'var(--color-info-bg)',
          border: '1px solid var(--color-info-border)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-4)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-info-text)',
          display: 'flex',
          gap: 'var(--space-2)',
          alignItems: 'center',
        }}
      >
        <span>ℹ️</span>
        <div>
          New accounts require administrative approval and plant assignment before full telemetry access is granted.
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* Full Name */}
        <div className="sm-form-group" style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="reg-name" className="sm-label">
            Full Name <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            id="reg-name"
            name="fullName"
            type="text"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (validationErrors.fullName) {
                setValidationErrors((prev) => ({ ...prev, fullName: undefined }));
              }
            }}
            placeholder="e.g. Vikram Sharma"
            required
            autoComplete="name"
            disabled={isLoading}
            className={`sm-input ${validationErrors.fullName ? 'sm-input--error' : ''}`}
            aria-invalid={Boolean(validationErrors.fullName)}
          />
          {validationErrors.fullName && (
            <span role="alert" style={{ display: 'block', marginTop: '4px', fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)' }}>
              {validationErrors.fullName}
            </span>
          )}
        </div>

        {/* Email */}
        <div className="sm-form-group" style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="reg-email" className="sm-label">
            Work Email Address <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            id="reg-email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (validationErrors.email) {
                setValidationErrors((prev) => ({ ...prev, email: undefined }));
              }
            }}
            placeholder="name@company.com"
            required
            autoComplete="email"
            disabled={isLoading}
            className={`sm-input ${validationErrors.email ? 'sm-input--error' : ''}`}
            aria-invalid={Boolean(validationErrors.email)}
          />
          {validationErrors.email && (
            <span role="alert" style={{ display: 'block', marginTop: '4px', fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)' }}>
              {validationErrors.email}
            </span>
          )}
        </div>

        {/* Password */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <PasswordInput
            id="reg-password"
            name="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (validationErrors.password) {
                setValidationErrors((prev) => ({ ...prev, password: undefined }));
              }
            }}
            label="Password (min 8 characters)"
            required
            autoComplete="new-password"
            disabled={isLoading}
            showStrengthMeter
            error={validationErrors.password}
          />
        </div>

        {/* Confirm Password */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <PasswordInput
            id="reg-confirm-password"
            name="confirmPassword"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (validationErrors.confirmPassword) {
                setValidationErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              }
            }}
            label="Confirm Password"
            required
            autoComplete="new-password"
            disabled={isLoading}
            error={validationErrors.confirmPassword}
          />
        </div>

        {/* Terms Acceptance */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--font-size-xs)' }}>
            <input
              type="checkbox"
              id="accept-terms"
              checked={acceptTerms}
              onChange={(e) => {
                setAcceptTerms(e.target.checked);
                if (validationErrors.acceptTerms) {
                  setValidationErrors((prev) => ({ ...prev, acceptTerms: undefined }));
                }
              }}
              disabled={isLoading}
              style={{ marginTop: '2px', width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
            />
            <span style={{ color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
              I agree to the SolarMind{' '}
              <a href="#terms" onClick={(e) => e.preventDefault()} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="#privacy" onClick={(e) => e.preventDefault()} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
                Privacy Policy
              </a>
              .
            </span>
          </label>
          {validationErrors.acceptTerms && (
            <span role="alert" style={{ display: 'block', marginTop: '4px', fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)' }}>
              {validationErrors.acceptTerms}
            </span>
          )}
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
              <span>Submitting Application...</span>
            </span>
          ) : (
            'Create Account'
          )}
        </button>
      </form>
    </AuthCard>
  );
};

export default RegisterPage;
