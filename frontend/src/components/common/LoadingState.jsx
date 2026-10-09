import { Loader2 } from 'lucide-react';

export const LoadingState = ({
  message = 'Loading solar telemetry data...',
  size = 'md',
  className = '',
}) => {
  const iconSize = size === 'sm' ? 20 : size === 'lg' ? 36 : 28;

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
        minHeight: '200px',
      }}
      role="status"
      aria-live="polite"
    >
      <Loader2
        size={iconSize}
        style={{
          color: 'var(--color-primary)',
          animation: 'spin 1s linear infinite',
          marginBottom: 'var(--space-3)',
        }}
      />
      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontWeight: 'var(--font-weight-medium)' }}>
        {message}
      </p>
    </div>
  );
};

export default LoadingState;
