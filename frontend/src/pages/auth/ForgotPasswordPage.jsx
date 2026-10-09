import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthCard from '../../components/auth/AuthCard';
import DevPreviewNotice from '../../components/auth/DevPreviewNotice';
import authService from '../../services/authService';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [validationError, setValidationError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setValidationError('');

    if (!email.trim() || !email.includes('@')) {
      setValidationError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      await authService.requestPasswordReset(email.trim());
      setIsSubmitted(true);
    } catch (err) {
      setErrorMessage(err.message || 'Unable to process password reset request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = () => {
    setEmail('operator@solarmind.io');
    setValidationError('');
    setErrorMessage(null);
  };

  if (isSubmitted) {
    return (
      <AuthCard
        title="Check Your Email"
        subtitle="Password recovery instructions dispatched."
        alertType="info"
        footer={
          <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)', textDecoration: 'none' }}>
            ← Back to Sign In
          </Link>
        }
      >
        <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-4)' }}>✉️</div>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            If an account is associated with <strong>{email}</strong>, a secure password reset link has been dispatched with a 30-minute validity window.
          </p>
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-bg-subtle)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-muted)',
              marginTop: 'var(--space-4)',
              textAlign: 'left',
            }}
          >
            🔒 <strong>Security Policy:</strong> To protect plant operator privacy, SolarMind does not disclose whether a requested email is registered in our database.
          </div>

          <div style={{ marginTop: 'var(--space-6)', display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
            <Link to="/reset-password?token=dev-preview-token-123" className="sm-btn sm-btn--secondary sm-btn--sm" style={{ textDecoration: 'none' }}>
              Simulate Reset Link (Demo)
            </Link>
          </div>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset Your Password"
      subtitle="Enter your verified work email address to receive reset instructions."
      alertMessage={errorMessage}
      alertType="error"
      footer={
        <div>
          Remembered your password?{' '}
          <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)', textDecoration: 'none' }}>
            Back to Sign In
          </Link>
        </div>
      }
    >
      <DevPreviewNotice onQuickFill={handleQuickFill} />

      <form onSubmit={handleSubmit} noValidate>
        <div className="sm-form-group" style={{ marginBottom: 'var(--space-6)' }}>
          <label htmlFor="recovery-email" className="sm-label">
            Email Address <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            id="recovery-email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (validationError) setValidationError('');
            }}
            placeholder="operator@solarmind.io"
            required
            autoComplete="email"
            disabled={isLoading}
            className={`sm-input ${validationError ? 'sm-input--error' : ''}`}
            aria-invalid={Boolean(validationError)}
          />
          {validationError && (
            <span role="alert" style={{ display: 'block', marginTop: '4px', fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)' }}>
              {validationError}
            </span>
          )}
        </div>

        <button
          type="submit"
          className="sm-btn sm-btn--primary"
          style={{ width: '100%', height: '44px', fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)' }}
          disabled={isLoading}
        >
          {isLoading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
              <span className="sm-spinner sm-spinner--sm" />
              <span>Sending Reset Instructions...</span>
            </span>
          ) : (
            'Send Password Reset Link'
          )}
        </button>
      </form>
    </AuthCard>
  );
};

export default ForgotPasswordPage;
