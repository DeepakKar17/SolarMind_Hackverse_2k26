import { useState, useRef, useEffect } from 'react';
import { Settings, Shield, Sparkles, LogIn, LogOut, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useSolarData } from '../../hooks/useSolarData';
import { useAuth } from '../../hooks/useAuth';

export const ProfileMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const { selectedPlant } = useSolarData();
  const { user, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    navigate('/login');
  };

  const getInitials = () => {
    if (user?.fullName) {
      const parts = user.fullName.split(' ');
      return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : parts[0].slice(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return 'SM';
  };

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Platform and workspace profile"
        style={{
          width: '34px',
          height: '34px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: isAuthenticated ? 'var(--color-primary)' : 'var(--color-primary-light)',
          color: isAuthenticated ? '#ffffff' : 'var(--color-primary)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '13px',
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
        }}
      >
        {getInitials()}
      </button>

      {isOpen && (
        <div
          className="sm-card"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '280px',
            padding: 'var(--space-2) 0',
            zIndex: 100,
            boxShadow: 'var(--shadow-xl)',
            animation: 'modalPop 150ms ease-out',
            backgroundColor: 'var(--color-bg-surface)',
          }}
        >
          <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
              {user?.fullName || 'SolarMind Operator'}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email || (isAuthenticated ? 'operator@solarmind.io' : 'Guest Operator')}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-primary)', marginTop: '4px', fontWeight: 'var(--font-weight-medium)' }}>
              Plant: {selectedPlant?.name || 'Rooftop String-1'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', padding: 'var(--space-1) 0' }}>
            <Link
              to="/settings"
              onClick={() => setIsOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: '8px var(--space-4)',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-xs)',
                textDecoration: 'none',
                transition: 'background-color var(--transition-fast)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Settings size={15} />
              <span>Plant & Inverter Settings</span>
            </Link>

            <Link
              to="/analytics"
              onClick={() => setIsOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: '8px var(--space-4)',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-xs)',
                textDecoration: 'none',
                transition: 'background-color var(--transition-fast)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Sparkles size={15} color="var(--color-primary)" />
              <span>Fleet Analytics</span>
            </Link>

            {isAuthenticated ? (
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: '8px var(--space-4)',
                  color: 'var(--color-danger)',
                  fontSize: 'var(--font-size-xs)',
                  background: 'none',
                  border: 'none',
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'background-color var(--transition-fast)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-danger-bg)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            ) : (
              <Link
                to="/login"
                onClick={() => setIsOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: '8px var(--space-4)',
                  color: 'var(--color-primary)',
                  fontSize: 'var(--font-size-xs)',
                  textDecoration: 'none',
                  fontWeight: 'var(--font-weight-semibold)',
                  transition: 'background-color var(--transition-fast)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-primary-light)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <LogIn size={15} />
                <span>Sign In to Account</span>
              </Link>
            )}
          </div>

          <div style={{ padding: 'var(--space-2) var(--space-4)', borderTop: '1px solid var(--color-border)', fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Shield size={12} color="var(--color-secondary)" />
            <span>{isAuthenticated ? 'Session Active (Secure)' : 'Preview Mode'}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileMenu;
