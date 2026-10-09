import { TrendingUp, TrendingDown } from 'lucide-react';

export const StatCard = ({
  title,
  value,
  unit,
  subtext,
  change,
  changeType,
  description,
  icon: Icon,
  variant = 'primary',
  trend,
  className = '',
  ...props
}) => {
  const getAccentBg = (v) => {
    switch (v) {
      case 'success': return 'var(--color-secondary-light)';
      case 'warning': return 'var(--color-warning-bg)';
      case 'danger': return 'var(--color-danger-bg)';
      case 'info': return 'var(--color-info-bg)';
      case 'primary':
      default: return 'var(--color-primary-light)';
    }
  };

  const getAccentColor = (v) => {
    switch (v) {
      case 'success': return 'var(--color-secondary)';
      case 'warning': return 'var(--color-warning)';
      case 'danger': return 'var(--color-danger)';
      case 'info': return 'var(--color-info)';
      case 'primary':
      default: return 'var(--color-primary)';
    }
  };

  return (
    <div
      className={`sm-card ${className}`}
      style={{ padding: 'var(--space-4) var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
      {...props}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {title}
        </span>
        {Icon && (
          <div
            style={{
              padding: '6px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: getAccentBg(variant),
              color: getAccentColor(variant),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={18} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-1)', marginTop: '2px' }}>
        <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)' }}>
            {unit}
          </span>
        )}
      </div>

      {(subtext || trend !== undefined) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-xs)' }}>
          {trend !== undefined && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                fontWeight: 'var(--font-weight-semibold)',
                color: trend >= 0 ? 'var(--color-secondary)' : 'var(--color-danger)',
              }}
            >
              {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {trend >= 0 ? `+${trend}%` : `${trend}%`}
            </span>
          )}
          {subtext && <span style={{ color: 'var(--color-text-muted)' }}>{subtext}</span>}
        </div>
      )}
    </div>
  );
};

export default StatCard;
