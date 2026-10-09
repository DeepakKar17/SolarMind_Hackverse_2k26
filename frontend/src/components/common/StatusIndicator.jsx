export const StatusIndicator = ({
  status = 'NORMAL',
  label,
  pulse = false,
  className = '',
}) => {
  const getStatusVariant = (st) => {
    switch (st?.toUpperCase()) {
      case 'ONLINE':
      case 'NORMAL':
      case 'HEALTHY':
      case 'ACTIVE':
        return 'success';
      case 'WARNING':
      case 'DEGRADED':
      case 'SHADING':
      case 'SOILING':
        return 'warning';
      case 'CRITICAL':
      case 'ERROR':
      case 'OFFLINE':
      case 'TRIPPED':
        return 'danger';
      case 'INFO':
      case 'STANDBY':
        return 'info';
      default:
        return 'neutral';
    }
  };

  const variant = getStatusVariant(status);

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        fontSize: 'var(--font-size-xs)',
        fontWeight: 'var(--font-weight-medium)',
        color: 'var(--color-text-secondary)',
      }}
    >
      <span
        className={`sm-status-dot sm-status-dot-${variant}`}
        style={
          pulse
            ? {
                animation: 'pulseGlow 2s infinite ease-in-out',
                boxShadow: `0 0 8px var(--color-${variant === 'neutral' ? 'border' : variant})`,
              }
            : undefined
        }
      />
      <span>{label || status}</span>
    </div>
  );
};

export default StatusIndicator;
