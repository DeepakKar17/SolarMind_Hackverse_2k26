import { Link } from 'react-router-dom';
import {
  Sun,
  ShieldCheck,
  Cpu,
  Code2,
  Database,
  ExternalLink,
  Activity,
  AlertTriangle,
  Layers,
  Camera,
  Wrench,
  CheckCircle2,
  HeartHandshake,
} from 'lucide-react';

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      style={{
        marginTop: 'auto',
        borderTop: '1px solid var(--color-border)',
        background: 'linear-gradient(180deg, var(--color-bg-surface) 0%, var(--color-bg-subtle) 100%)',
        color: 'var(--color-text-secondary)',
        fontSize: 'var(--font-size-xs)',
      }}
    >
      {/* Upper Footer: Multi-Column Overview */}
      <div
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          padding: 'var(--space-8) var(--space-6) var(--space-6)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-8)',
        }}
      >
        {/* Column 1: Brand & Core Scope */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)',
              }}
            >
              <Sun size={18} />
            </div>
            <strong
              style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--color-text-primary)',
                letterSpacing: '-0.02em',
              }}
            >
              SolarMind ☀️🧠
            </strong>
          </div>
          <p style={{ margin: 0, lineHeight: 1.5, color: 'var(--color-text-muted)' }}>
            AI-assisted solar health monitoring & root-cause fault diagnosis platform tailored for residential single-string and distributed commercial PV installations.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-secondary-light)',
                color: 'var(--color-secondary)',
                fontWeight: 'var(--font-weight-semibold)',
                fontSize: '11px',
              }}
            >
              <CheckCircle2 size={12} />
              IEC 61724-1 Standard
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-primary-light)',
                color: 'var(--color-primary)',
                fontWeight: 'var(--font-weight-semibold)',
                fontSize: '11px',
              }}
            >
              <ShieldCheck size={12} />
              Zero-Falsification Policy
            </span>
          </div>
        </div>

        {/* Column 2: Diagnostic & Analytics Modules */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <strong style={{ color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>
            Diagnostic Platform
          </strong>
          <Link to="/dashboard" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={13} color="var(--color-primary)" /> Live Power & Telemetry
          </Link>
          <Link to="/plants" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={13} color="var(--color-secondary)" /> Solar Plants & Inverters
          </Link>
          <Link to="/diagnosis" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={13} color="var(--color-accent-amber)" /> Root-Cause AI Engine
          </Link>
          <Link to="/photos" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Camera size={13} color="var(--color-info)" /> Geo Photo AI Inspection
          </Link>
          <Link to="/work-orders" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Wrench size={13} color="var(--color-text-muted)" /> Field Maintenance & Work Orders
          </Link>
        </div>

        {/* Column 3: OEM Knowledge & Catalogs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <strong style={{ color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>
            OEM Knowledge Catalogs
          </strong>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', marginBottom: '2px' }}>
            Verbatim manufacturer manuals & hazard warnings:
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {['Deye SUN-70K to 110K', 'Sungrow SG Series', 'SMA Tripower', 'Growatt MIN', 'GoodWe DNS'].map((oem) => (
              <span
                key={oem}
                style={{
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border)',
                  fontSize: '11px',
                  color: 'var(--color-text-primary)',
                  fontWeight: 'var(--font-weight-medium)',
                }}
              >
                {oem}
              </span>
            ))}
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <Link
              to="/admin/fault-catalog"
              style={{
                color: 'var(--color-primary)',
                textDecoration: 'none',
                fontWeight: 'var(--font-weight-semibold)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              Browse Full Fault Code Catalog <ExternalLink size={12} />
            </Link>
          </div>
        </div>

        {/* Column 4: Operational Status & System Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <strong style={{ color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>
            System Health & API
          </strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Code2 size={13} color="var(--color-primary)" />
                <span>FastAPI REST Layer</span>
              </span>
              <span style={{ color: 'var(--color-success)', fontWeight: 'var(--font-weight-semibold)' }}>Online</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Database size={13} color="var(--color-secondary)" />
                <span>Database Sync</span>
              </span>
              <span style={{ color: 'var(--color-success)', fontWeight: 'var(--font-weight-semibold)' }}>Connected</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Cpu size={13} color="var(--color-accent-amber)" />
                <span>Physics & Loss Engine</span>
              </span>
              <span style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)' }}>Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Safety Hazard Warning Banner */}
      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          borderBottom: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-warning-bg)',
          padding: 'var(--space-2) var(--space-6)',
        }}
      >
        <div
          style={{
            maxWidth: '1440px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: '11px',
            color: 'var(--color-warning-text)',
            lineHeight: 1.4,
          }}
        >
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          <span>
            <strong>Electrical Hazard Warning:</strong> SolarMind provides diagnostic recommendations. High-voltage DC/AC equipment must only be serviced by certified solar engineers. Never open energized inverter enclosures or disconnect DC strings under load.
          </span>
        </div>
      </div>

      {/* Lower Footer: Copyright & Demonstration Badges */}
      <div
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          padding: 'var(--space-4) var(--space-6)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
          color: 'var(--color-text-muted)',
          fontSize: '11px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span>© {currentYear} SolarMind AI Technologies. All rights reserved.</span>
          <span>•</span>
          <span style={{ color: 'var(--color-text-secondary)', fontWeight: 'var(--font-weight-medium)' }}>
            Empowering Clean Energy Generation with Intelligent Diagnostics
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)' }}>
            <HeartHandshake size={13} />
            Hackathon Jury Demonstration Suite
          </span>
          <span>•</span>
          <span>v0.1.0-prod</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
