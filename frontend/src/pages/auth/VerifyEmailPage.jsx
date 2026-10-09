import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import AuthCard from '../../components/auth/AuthCard';
import authService from '../../services/authService';

export const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error'
  const [errorMessage, setErrorMessage] = useState(null);
  const [resendEmail, setResendEmail] = useState('');
  const [resendStatus, setResendStatus] = useState(null);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('Verification token is missing. Please click the full link sent to your email.');
      return;
    }

    let isMounted = true;
    const verify = async () => {
      try {
        await authService.verifyEmail(token);
        if (isMounted) {
          setStatus('success');
        }
      } catch (err) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage(err.message || 'Verification link is invalid or has expired.');
        }
      }
    };

    verify();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleResend = async (e) => {
    e.preventDefault();
    if (!resendEmail || !resendEmail.includes('@')) {
      setResendStatus({ type: 'error', message: 'Please enter a valid email address.' });
      return;
    }

    setIsResending(true);
    setResendStatus(null);
    try {
      await authService.resendVerification(resendEmail.trim());
      setResendStatus({
        type: 'success',
        message: 'A new verification link has been dispatched to your email.',
      });
    } catch (err) {
      setResendStatus({
        type: 'error',
        message: err.message || 'Unable to resend verification email. Please try again.',
      });
    } finally {
      setIsResending(false);
    }
  };

  if (status === 'verifying') {
    return (
      <AuthCard
        title="Verifying Email"
        subtitle="Validating your security verification token..."
      >
        <div style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
          <div className="sm-spinner sm-spinner--lg" style={{ margin: '0 auto var(--space-4) auto' }} />
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            Confirming your account authorization with SolarMind security services...
          </p>
        </div>
      </AuthCard>
    );
  }

  if (status === 'success') {
    return (
      <AuthCard
        title="Email Verified"
        subtitle="Your email address has been successfully confirmed."
        alertMessage="Your account is now verified and active."
        alertType="success"
        footer={
          <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)', textDecoration: 'none' }}>
            Return to Sign In
          </Link>
        }
      >
        <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-4)' }}>✅</div>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            Thank you for verifying your email address. You now have full authorized access to your assigned solar plants and telemetry dashboards.
          </p>
          <div style={{ marginTop: 'var(--space-6)' }}>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="sm-btn sm-btn--primary"
              style={{ width: '100%', height: '44px', fontSize: 'var(--font-size-base)' }}
            >
              Sign In to SolarMind
            </button>
          </div>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Verification Failed"
      subtitle="We were unable to verify your email address."
      alertMessage={errorMessage}
      alertType="error"
      footer={
        <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)', textDecoration: 'none' }}>
          ← Return to Sign In
        </Link>
      }
    >
      <div style={{ textAlign: 'center', padding: 'var(--space-2) 0' }}>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-6)' }}>
          The verification link may have expired (links are valid for 24 hours) or was already used. Enter your email below to request a new verification link.
        </p>

        {resendStatus && (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: resendStatus.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
              border: `1px solid ${resendStatus.type === 'success' ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
              color: resendStatus.type === 'success' ? 'var(--color-success-text)' : 'var(--color-danger-text)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-4)',
              fontSize: 'var(--font-size-xs)',
              textAlign: 'left',
            }}
          >
            {resendStatus.message}
          </div>
        )}

        <form onSubmit={handleResend} noValidate>
          <div className="sm-form-group" style={{ marginBottom: 'var(--space-4)', textAlign: 'left' }}>
            <label htmlFor="resend-email" className="sm-label">
              Email Address
            </label>
            <input
              id="resend-email"
              type="email"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              placeholder="operator@solarmind.io"
              required
              disabled={isResending}
              className="sm-input"
            />
          </div>

          <button
            type="submit"
            className="sm-btn sm-btn--secondary"
            style={{ width: '100%', height: '40px', fontSize: 'var(--font-size-sm)' }}
            disabled={isResending}
          >
            {isResending ? 'Resending Link...' : 'Resend Verification Email'}
          </button>
        </form>
      </div>
    </AuthCard>
  );
};

export default VerifyEmailPage;
