import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import AuthCard from '../../components/auth/AuthCard';
import PasswordInput from '../../components/auth/PasswordInput';
import authService from '../../services/authService';

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const validate = () => {
    const errors = {};
    if (!newPassword) {
      errors.newPassword = 'New password is required.';
    } else if (newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters long.';
    }
    if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!token) {
      setErrorMessage('Password reset token is missing from URL.');
      return;
    }

    if (!validate()) {
      return;
    }

    setIsLoading(true);
    try {
      await authService.resetPassword({
        token,
        newPassword,
        confirmPassword,
      });
      setIsSuccess(true);
    } catch (err) {
      setErrorMessage(err.message || 'Unable to reset password. The link may have expired.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthCard
        title="Invalid Reset Link"
        subtitle="This password reset link is missing a valid security token."
        alertMessage="The password reset link you clicked appears to be incomplete or expired."
        alertType="error"
        footer={
          <Link to="/forgot-password" style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)', textDecoration: 'none' }}>
            Request New Reset Link
          </Link>
        }
      >
        <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            Please submit a new password reset request from the forgot password page to receive a fresh verification link.
          </p>
          <div style={{ marginTop: 'var(--space-6)' }}>
            <Link to="/forgot-password" className="sm-btn sm-btn--primary" style={{ width: '100%', textDecoration: 'none', display: 'inline-block', textAlign: 'center' }}>
              Request Password Reset
            </Link>
          </div>
        </div>
      </AuthCard>
    );
  }

  if (isSuccess) {
    return (
      <AuthCard
        title="Password Updated"
        subtitle="Your password has been successfully reset."
        alertMessage="You can now sign in using your new password."
        alertType="success"
        footer={
          <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)', textDecoration: 'none' }}>
            Return to Sign In
          </Link>
        }
      >
        <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-4)' }}>🎉</div>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            Your account credentials have been securely updated. All previous active sessions have been invalidated.
          </p>
          <div style={{ marginTop: 'var(--space-6)' }}>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="sm-btn sm-btn--primary"
              style={{ width: '100%', height: '44px', fontSize: 'var(--font-size-base)' }}
            >
              Sign In Now
            </button>
          </div>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Set New Password"
      subtitle="Choose a strong password to secure your SolarMind plant access."
      alertMessage={errorMessage}
      alertType="error"
      footer={
        <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)', textDecoration: 'none' }}>
          ← Back to Sign In
        </Link>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        {/* New Password */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <PasswordInput
            id="reset-new-password"
            name="newPassword"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              if (validationErrors.newPassword) {
                setValidationErrors((prev) => ({ ...prev, newPassword: undefined }));
              }
            }}
            label="New Password"
            required
            autoComplete="new-password"
            disabled={isLoading}
            showStrengthMeter
            error={validationErrors.newPassword}
          />
        </div>

        {/* Confirm Password */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <PasswordInput
            id="reset-confirm-password"
            name="confirmPassword"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (validationErrors.confirmPassword) {
                setValidationErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              }
            }}
            label="Confirm New Password"
            required
            autoComplete="new-password"
            disabled={isLoading}
            error={validationErrors.confirmPassword}
          />
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
              <span>Updating Password...</span>
            </span>
          ) : (
            'Reset Password'
          )}
        </button>
      </form>
    </AuthCard>
  );
};

export default ResetPasswordPage;
