import { Link, useLocation } from 'react-router-dom';
import { Sun, Activity, AlertCircle, Settings } from 'lucide-react';
import { useSolarData } from '../../hooks/useSolarData';

export const Navbar = () => {
  const location = useLocation();
  const { alerts, isLiveConnected } = useSolarData();
  const activeAlertsCount = alerts.filter((a) => a.status === 'ACTIVE').length;

  const navLinks = [
    { path: '/', label: 'Overview', icon: Activity },
    { path: '/diagnostics', label: 'Fault Diagnostics', icon: AlertCircle, badge: activeAlertsCount },
    { path: '/system', label: 'Inverter Config', icon: Settings },
  ];

  return (
    <header
      style={{
        borderBottom: '1px solid var(--color-border)',
        background: 'rgba(11, 15, 25, 0.85)',
        backdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        className="container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '70px',
        }}
      >
        {/* Brand Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-solar-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            <Sun size={22} color="#111827" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-family-display)',
                  fontSize: 'var(--font-size-xl)',
                  fontWeight: 'var(--font-weight-extrabold)',
                  letterSpacing: '-0.02em',
                  color: 'var(--color-text-primary)',
                }}
              >
                Solar<span style={{ color: 'var(--color-solar-primary)' }}>Mind</span>
              </span>
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: 'var(--color-solar-light)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                }}
              >
                V1.0
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginTop: '-2px' }}>
              Single-String Inverter AI
            </span>
          </div>
        </Link>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--color-solar-primary)' : 'var(--color-text-secondary)',
                  background: isActive ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                  border: `1px solid ${isActive ? 'rgba(245, 158, 11, 0.25)' : 'transparent'}`,
                  transition: 'all var(--transition-fast)',
                }}
              >
                <Icon size={16} />
                <span>{link.label}</span>
                {Boolean(link.badge) && (
                  <span
                    style={{
                      background: 'var(--color-danger)',
                      color: '#fff',
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-full)',
                      fontWeight: 700,
                    }}
                  >
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Status Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--color-border)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <span className={`pulse-indicator ${isLiveConnected ? 'pulse-green' : 'pulse-amber'}`} />
            <span>{isLiveConnected ? 'Inverter Live' : 'Reconnecting...'}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
