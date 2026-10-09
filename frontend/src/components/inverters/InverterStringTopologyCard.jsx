import { Card, Badge } from '../common';
import { Layers, Zap, Sun, Compass, Radio } from 'lucide-react';
import InverterDiagnosticBadge from './InverterDiagnosticBadge';
import { formatVoltage, formatCurrent, formatPower } from '../../utils/formatters';

export const InverterStringTopologyCard = ({ mpptConfiguration = [], inverterName }) => {
  if (!mpptConfiguration || mpptConfiguration.length === 0) {
    return (
      <Card title="PV String & MPPT Channel Architecture">
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
          No string or MPPT telemetry mappings registered for this inverter.
        </p>
      </Card>
    );
  }

  const totalStrings = mpptConfiguration.reduce(
    (acc, mppt) => acc + (mppt.strings?.length || 0),
    0
  );

  return (
    <Card
      title={`PV String & MPPT Channel Topology (${mpptConfiguration.length} MPPTs, ${totalStrings} Strings)`}
      subtitle={`Hardware electrical mapping and string stringing configuration for ${inverterName}`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {mpptConfiguration.map((mppt, mpptIdx) => (
          <div
            key={mppt.mpptId || mpptIdx}
            style={{
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-canvas)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            {/* MPPT Header */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-2)',
                paddingBottom: 'var(--space-2)',
                borderBottom: '1px solid var(--color-border-light)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-primary-light)',
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Layers size={16} />
                </div>
                <div>
                  <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                    {mppt.name || mppt.mpptId}
                  </strong>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    Tracking Input: {formatVoltage(mppt.voltageV)} • {formatCurrent(mppt.currentA)} • {formatPower(mppt.powerKw)} DC
                  </span>
                </div>
              </div>

              <InverterDiagnosticBadge status={mppt.status} size="sm" />
            </div>

            {/* Strings list connected to this MPPT */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
              {(mppt.strings || []).map((string, strIdx) => (
                <div
                  key={string.stringId || strIdx}
                  style={{
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--font-size-xs)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-2)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <strong style={{ color: 'var(--color-primary)' }}>
                      {string.name || string.stringId}
                    </strong>
                    <Badge variant={string.status === 'NORMAL' ? 'success' : 'warning'} size="sm">
                      {string.status}
                    </Badge>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '10px' }}>Module Spec</span>
                      <strong>{string.panelCount}x {string.panelWattage}W ({string.panelType || 'Mono'})</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '10px' }}>Geometry</span>
                      <strong>{string.tiltAngle}° Tilt / {string.azimuthAngle}° Azimuth</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '10px' }}>DC String Voltage</span>
                      <strong>{formatVoltage(string.voltageV)}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '10px' }}>DC String Current</span>
                      <strong>{formatCurrent(string.currentA)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default InverterStringTopologyCard;
