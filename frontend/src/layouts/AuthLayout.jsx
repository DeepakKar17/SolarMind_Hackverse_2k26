import { Outlet, Link } from 'react-router-dom';

export const AuthLayout = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--color-bg-canvas)',
        backgroundImage: 'radial-gradient(var(--color-bg-muted) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* Top Simple Bar */}
      <header
        style={{
          padding: 'var(--space-4) var(--space-8)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--color-border-subtle)',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            textDecoration: 'none',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--color-accent-amber) 0%, var(--color-primary) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: 'bold',
            }}
          >
            ☀️
          </div>
          <span
            style={{
              fontFamily: 'var(--font-family-display)',
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-sidebar-bg)',
            }}
          >
            Solar<span style={{ color: 'var(--color-primary)' }}>Mind</span>
          </span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <Link
            to="/dashboard"
            className="sm-btn sm-btn--ghost sm-btn--sm"
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}
          >
            <span>Preview Dashboard</span>
            <span>→</span>
          </Link>
        </div>
      </header>

      {/* Main Canvas */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-8) var(--space-4)',
        }}
      >
        <div style={{ width: '100%', maxWidth: '1000px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-8)', alignItems: 'center' }}>
          {/* Left Hero Pitch (Hidden on small screens via auto-fit flex or visible) */}
          <div style={{ padding: 'var(--space-4)' }} className="sm-auth-hero">
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-primary-light)',
                color: 'var(--color-primary)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'var(--font-weight-semibold)',
                marginBottom: 'var(--space-4)',
              }}
            >
              <span>⚡ Solar Fleet Intelligence</span>
            </div>

            <h2
              style={{
                fontFamily: 'var(--font-family-display)',
                fontSize: 'var(--font-size-3xl)',
                fontWeight: 'var(--font-weight-extrabold)',
                color: 'var(--color-sidebar-bg)',
                lineHeight: 1.2,
                marginBottom: 'var(--space-4)',
              }}
            >
              Autonomous Telemetry & Fault Diagnosis for Solar Assets
            </h2>

            <p
              style={{
                fontSize: 'var(--font-size-md)',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.6,
                marginBottom: 'var(--space-6)',
              }}
            >
              Empower operations with sub-minute MPPT diagnostics, IEC 61724 performance ratio analytics, and automated maintenance dispatch.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {[
                { icon: '📡', title: 'Continuous Telemetry & Inverter Health', desc: 'Real-time monitoring across Sungrow, Huawei, and Deye inverters' },
                { icon: '🔍', title: 'AI-Assisted Anomaly Detection', desc: 'Instant identification of string open-circuits, soiling, and derating' },
                { icon: '🛠️', title: 'Field Service SLA Dispatch', desc: 'Direct technician work orders with photo verification evidence' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'rgba(255, 255, 255, 0.6)',
                    border: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <span style={{ fontSize: '20px' }}>{item.icon}</span>
                  <div>
                    <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>{item.title}</strong>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Form Card */}
          <div>
            <Outlet />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          padding: 'var(--space-4) var(--space-8)',
          textAlign: 'center',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-muted)',
          borderTop: '1px solid var(--color-border-subtle)',
        }}
      >
        <div>
          © {new Date().getFullYear()} SolarMind Intelligence Platform. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default AuthLayout;
