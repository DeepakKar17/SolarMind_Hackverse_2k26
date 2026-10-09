import { Link } from 'react-router-dom';

export const AuthCard = ({
  title,
  subtitle,
  children,
  footer,
  alertMessage,
  alertType = 'error',
}) => {
  const alertStyles = {
    error: {
      bg: 'var(--color-danger-bg)',
      border: 'var(--color-danger-border)',
      text: 'var(--color-danger-text)',
      icon: '⚠️',
    },
    success: {
      bg: 'var(--color-success-bg)',
      border: 'var(--color-success-border)',
      text: 'var(--color-success-text)',
      icon: '✅',
    },
    info: {
      bg: 'var(--color-info-bg)',
      border: 'var(--color-info-border)',
      text: 'var(--color-info-text)',
      icon: 'ℹ️',
    },
  };

  const currentAlert = alertStyles[alertType] || alertStyles.error;

  return (
    <div
      className="sm-card"
      style={{
        width: '100%',
        maxWidth: '460px',
        margin: '0 auto',
        padding: 'var(--space-8)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-xl)',
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            textDecoration: 'none',
            marginBottom: 'var(--space-4)',
          }}
          aria-label="SolarMind Home"
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, var(--color-accent-amber) 0%, var(--color-primary) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '20px',
              fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
            }}
          >
            ☀️
          </div>
          <span
            style={{
              fontFamily: 'var(--font-family-display)',
              fontSize: 'var(--font-size-xl)',
              fontWeight: 'var(--font-weight-extrabold)',
              color: 'var(--color-sidebar-bg)',
              letterSpacing: '-0.02em',
            }}
          >
            Solar<span style={{ color: 'var(--color-primary)' }}>Mind</span>
          </span>
        </Link>

        {title && (
          <h1
            style={{
              fontFamily: 'var(--font-family-display)',
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-text-primary)',
              margin: '0 0 var(--space-1) 0',
            }}
          >
            {title}
          </h1>
        )}

        {subtitle && (
          <p
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              margin: 0,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {alertMessage && (
        <div
          role="alert"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: currentAlert.bg,
            border: `1px solid ${currentAlert.border}`,
            color: currentAlert.text,
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-5)',
            fontSize: 'var(--font-size-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <span>{currentAlert.icon}</span>
          <div>{alertMessage}</div>
        </div>
      )}

      {children}

      {footer && (
        <div
          style={{
            marginTop: 'var(--space-6)',
            paddingTop: 'var(--space-5)',
            borderTop: '1px solid var(--color-border-subtle)',
            textAlign: 'center',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
};

export default AuthCard;
