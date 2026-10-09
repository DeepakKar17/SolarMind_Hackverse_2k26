import { AlertCircle, RefreshCw } from 'lucide-react';
import Button from './Button';

export const ErrorState = ({
  title = 'Failed to load telemetry',
  message = 'An error occurred while communicating with the solar inverter API.',
  onRetry,
  actionText,
  onAction,
  className = '',
}) => {
  const handleAction = onAction || onRetry;
  const buttonLabel = actionText || (onRetry ? 'Retry Request' : 'Action');

  return (
    <div
      className={`sm-card ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-10) var(--space-6)',
        textAlign: 'center',
        borderColor: 'var(--color-danger-border)',
        backgroundColor: 'var(--color-danger-bg)',
      }}
      role="alert"
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          color: 'var(--color-danger)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 'var(--space-3)',
        }}
      >
        <AlertCircle size={26} />
      </div>

      <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-danger-text)', marginBottom: 'var(--space-1)' }}>
        {title}
      </h3>

      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', maxWidth: '420px', marginBottom: handleAction ? 'var(--space-4)' : 0 }}>
        {message}
      </p>

      {handleAction && (
        <Button variant="outline" size="sm" onClick={handleAction} icon={onRetry && !actionText ? RefreshCw : undefined}>
          {buttonLabel}
        </Button>
      )}
    </div>
  );
};

export default ErrorState;
