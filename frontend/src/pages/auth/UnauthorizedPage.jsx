import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import AuthCard from '../../components/auth/AuthCard';

export const UnauthorizedPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <AuthCard
      title="Access Restricted"
      subtitle="403 Forbidden — Insufficient Permissions"
      alertType="error"
      footer={
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-4)' }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="sm-btn sm-btn--ghost sm-btn--sm"
          >
            ← Go Back
          </button>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="sm-btn sm-btn--ghost sm-btn--sm"
            style={{ color: 'var(--color-danger)' }}
          >
            Sign In with Different Account
          </button>
        </div>
      }
    >
      <div style={{ textAlign: 'center', padding: 'var(--space-2) 0' }}>
        <div style={{ fontSize: '56px', marginBottom: 'var(--space-4)' }}>🛡️</div>

        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-4)' }}>
          Your current account {user?.email ? (<strong>({user.email})</strong>) : ''} does not have the required role or plant access rights to view this page.
        </p>

        <div
          style={{
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-bg-subtle)',
            borderRadius: 'var(--radius-lg)',
            textAlign: 'left',
            marginBottom: 'var(--space-6)',
            fontSize: 'var(--font-size-xs)',
          }}
        >
          <strong style={{ color: 'var(--color-text-primary)', display: 'block', marginBottom: 'var(--space-2)' }}>
            Role Permissions Overview:
          </strong>
          <ul style={{ margin: 0, paddingLeft: 'var(--space-4)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            <li><strong>VIEWER:</strong> Real-time dashboard and telemetry view only.</li>
            <li><strong>OPERATOR:</strong> Plant settings, report exports, and alert acknowledgement.</li>
            <li><strong>TECHNICIAN:</strong> Diagnosis inspection, work orders, and photo AI uploads.</li>
            <li><strong>ADMINISTRATOR:</strong> Full plant management and user permission assignment.</li>
          </ul>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Link
            to="/dashboard"
            className="sm-btn sm-btn--primary"
            style={{ width: '100%', textDecoration: 'none', display: 'inline-block', textAlign: 'center' }}
          >
            Return to Dashboard
          </Link>
          <a
            href="mailto:support@solarmind.io?subject=SolarMind%20Permission%20Request"
            className="sm-btn sm-btn--secondary"
            style={{ width: '100%', textDecoration: 'none', display: 'inline-block', textAlign: 'center' }}
          >
            Request Elevated Role from Admin
          </a>
        </div>
      </div>
    </AuthCard>
  );
};

export default UnauthorizedPage;
