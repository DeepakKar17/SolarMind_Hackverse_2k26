import { Link } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';

export const NotFoundPage = () => {
  return (
    <div
      style={{
        minHeight: '400px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 'var(--spacing-12) var(--spacing-6)',
      }}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(245, 158, 11, 0.1)',
          color: 'var(--color-solar-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 'var(--spacing-4)',
        }}
      >
        <Compass size={32} />
      </div>
      <h2 style={{ marginBottom: 'var(--spacing-2)' }}>Page Not Found</h2>
      <p style={{ maxWidth: '420px', marginBottom: 'var(--spacing-6)', color: 'var(--color-text-secondary)' }}>
        The requested diagnostic or telemetry view does not exist in this installation.
      </p>
      <Link to="/" className="btn btn-primary">
        <ArrowLeft size={16} />
        <span>Return to Overview</span>
      </Link>
    </div>
  );
};

export default NotFoundPage;
