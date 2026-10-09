import { NavLink } from 'react-router-dom';
import {
  Sun,
  LayoutDashboard,
  Building2,
  Cpu,
  Activity,
  AlertTriangle,
  Camera,
  BarChart3,
  Wrench,
  CalendarCheck,
  Bell,
  Settings,
  X,
  Layers,
  ShieldAlert,
  Users,
  Sliders,
  Radio,
  FileText,
} from 'lucide-react';
import { useSolarData } from '../../hooks/useSolarData';
import { usePermissions } from '../../hooks/usePermissions';
import { useLanguage } from '../../context/LanguageContext';

export const Sidebar = ({ isOpen, onClose }) => {
  const { alerts, workOrders } = useSolarData();
  const { isAdmin } = usePermissions();
  const { t } = useLanguage();

  const activeAlertsCount = alerts.filter((a) => a.status === 'ACTIVE').length;
  const activeWorkOrdersCount = workOrders.filter(
    (w) => w.status === 'OPEN' || w.status === 'SCHEDULED' || w.status === 'IN_PROGRESS'
  ).length;

  const mainNavGroups = [
    {
      groupLabel: t('nav.monitoring', 'Monitoring & Analytics'),
      items: [
        { to: '/dashboard', label: t('nav.dashboard', 'Dashboard'), icon: LayoutDashboard },
        { to: '/home/dashboard', label: t('nav.homeowner', 'Homeowner Portal'), icon: Sun },
        { to: '/plants', label: t('nav.plants', 'Solar Plants'), icon: Building2 },
        { to: '/inverters', label: t('nav.inverters', 'Inverters & Strings'), icon: Cpu },
        { to: '/monitoring', label: t('nav.monitoring', 'Live Telemetry'), icon: Activity },
        { to: '/analytics', label: t('nav.analytics', 'Fleet Analytics'), icon: BarChart3 },
      ],
    },
    {
      groupLabel: t('nav.diagnostics', 'Diagnostics & AI Vision'),
      items: [
        { to: '/diagnosis', label: t('nav.diagnostics', 'Fault Diagnoses'), icon: AlertTriangle, badge: activeAlertsCount },
        { to: '/geo-photo', label: t('nav.geoPhoto', 'Photo Inspection'), icon: Camera },
        { to: '/alerts', label: t('nav.alerts', 'System Alerts'), icon: Bell, badge: activeAlertsCount },
      ],
    },
    {
      groupLabel: t('nav.maintenance', 'Maintenance & Service'),
      items: [
        { to: '/technician/dashboard', label: t('nav.technician', 'Technician Center'), icon: Wrench },
        { to: '/work-orders', label: t('nav.workOrders', 'Work Orders'), icon: CalendarCheck, badge: activeWorkOrdersCount },
        { to: '/maintenance', label: t('nav.maintenance', 'Maintenance Log'), icon: CalendarCheck },
      ],
    },
    ...(isAdmin
      ? [
          {
            groupLabel: t('nav.admin', 'Administration & Fleet Ops'),
            items: [
              { to: '/admin/dashboard', label: 'Admin Overview', icon: ShieldAlert },
              { to: '/admin/users', label: 'User Accounts', icon: Users },
              { to: '/admin/roles', label: 'Roles & Policies', icon: Sliders },
              { to: '/admin/integrations', label: 'Integrations Hub', icon: Radio },
              { to: '/admin/audit-logs', label: 'Audit Trail', icon: FileText },
            ],
          },
        ]
      : []),
    {
      groupLabel: t('nav.settings', 'System'),
      items: [
        { to: '/settings', label: t('nav.settings', 'Settings'), icon: Settings },
        { to: '/design-system', label: 'Design System UI', icon: Layers },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 99,
          }}
          aria-hidden="true"
        />
      )}

      <aside className={`sm-sidebar ${isOpen ? 'sm-sidebar-open' : ''}`}>
        {/* Brand Header */}
        <div
          style={{
            height: 'var(--header-height)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 var(--space-5)',
            borderBottom: '1px solid var(--color-sidebar-border)',
            flexShrink: 0,
          }}
        >
          <NavLink
            to="/dashboard"
            onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', textDecoration: 'none' }}
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 0 14px rgba(37, 99, 235, 0.45)',
              }}
            >
              <Sun size={20} strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-extrabold)', color: '#ffffff', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>SolarMind</span>
                <span style={{ fontSize: '9px', backgroundColor: 'rgba(37, 99, 235, 0.35)', color: '#93c5fd', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                  PRO
                </span>
              </div>
            </div>
          </NavLink>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="sm-icon-btn sm-mobile-close-btn"
              style={{ color: 'var(--color-sidebar-text-muted)', display: 'none' }}
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Scrollable Navigation Groups */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-2)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            flex: 1,
            overflowY: 'auto',
          }}
        >
          {mainNavGroups.map((group) => (
            <div key={group.groupLabel} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div
                style={{
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  color: 'var(--color-sidebar-text-muted)',
                  fontWeight: 700,
                  padding: 'var(--space-1) var(--space-3)',
                  letterSpacing: '0.06em',
                }}
              >
                {group.groupLabel}
              </div>

              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    style={({ isActive }) => ({
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      color: isActive ? '#ffffff' : 'var(--color-sidebar-text-muted)',
                      backgroundColor: isActive ? 'var(--color-sidebar-surface)' : 'transparent',
                      borderLeft: `3px solid ${isActive ? 'var(--color-sidebar-active)' : 'transparent'}`,
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: isActive ? 600 : 500,
                      textDecoration: 'none',
                      transition: 'all var(--transition-fast)',
                    })}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <Icon size={16} />
                      <span>{item.label}</span>
                    </div>
                    {Boolean(item.badge) && (
                      <span
                        style={{
                          backgroundColor: 'var(--color-danger)',
                          color: '#ffffff',
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '0px 5px',
                          borderRadius: 'var(--radius-full)',
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer info in sidebar */}
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--color-sidebar-border)', fontSize: '11px', color: 'var(--color-sidebar-text-muted)', flexShrink: 0 }}>
          <div style={{ fontWeight: 600, color: '#e2e8f0' }}>Single-String PV Platform</div>
          <div style={{ color: '#64748b', fontSize: '10px' }}>FastAPI REST & React 18</div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
