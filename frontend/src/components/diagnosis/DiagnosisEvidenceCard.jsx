import { Card, Badge, DataTable } from '../common';
import { AlertCircle, AlertTriangle, Cpu, Layers, CheckCircle2, ShieldAlert } from 'lucide-react';
import { formatVoltage, formatCurrent, formatPower, formatIrradiance } from '../../utils/formatters';

export const DiagnosisEvidenceCard = ({
  probableCause,
  rootCauseSummary,
  electricalSignatures = {},
  comparisonMetrics = [],
  dataQualityWarning = null,
  hasInsufficientEvidence = false,
  engineType,
  isSuspicionOnly = false,
}) => {
  const comparisonColumns = [
    {
      key: 'parameter',
      label: 'Telemetry Parameter',
      render: (val) => <strong style={{ color: 'var(--color-text-primary)' }}>{val}</strong>,
    },
    {
      key: 'measured',
      label: 'Measured Sensor Reading',
      render: (val) => <span style={{ fontWeight: 600, color: 'var(--color-danger)' }}>{val}</span>,
    },
    {
      key: 'expected',
      label: 'Model Expected Clear-Sky',
      render: (val) => <span style={{ color: 'var(--color-success)', fontWeight: 500 }}>{val}</span>,
    },
    {
      key: 'deviation',
      label: 'Estimated Deficit',
      render: (val) => (
        <Badge variant={val.includes('+') ? 'warning' : 'danger'} size="sm">
          {val}
        </Badge>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Insufficient Evidence Warning Banner */}
      {hasInsufficientEvidence && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-3)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-warning-light)',
            border: '1px solid var(--color-warning-border)',
            color: 'var(--color-warning-text)',
          }}
          role="alert"
        >
          <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ fontSize: 'var(--font-size-sm)', display: 'block' }}>
              INSUFFICIENT TELEMETRY EVIDENCE FOR CONCLUSIVE CONFIRMATION
            </strong>
            <p style={{ fontSize: 'var(--font-size-xs)', margin: '4px 0 0 0', lineHeight: 1.4 }}>
              The diagnostic classifier flags this anomaly as an unconfirmed suspicion. Hardware communication dropouts or missing sensor readings prevent definitive root cause attribution. Field measurement verification is required.
            </p>
          </div>
        </div>
      )}

      {/* Data Quality Warning Banner */}
      {dataQualityWarning && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(234, 179, 8, 0.1)',
            border: '1px solid rgba(234, 179, 8, 0.25)',
            color: 'var(--color-warning-text)',
            fontSize: 'var(--font-size-xs)',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{dataQualityWarning}</span>
        </div>
      )}

      {/* Probable Cause & Root Cause Overview */}
      <Card title="Probable Root Cause & Physical Mechanism">
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', lineHeight: 1.6, margin: 0 }}>
          {probableCause}
        </p>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)', lineHeight: 1.5 }}>
          {rootCauseSummary}
        </p>
      </Card>

      {/* Sensor Signatures Matrix */}
      <Card title="Electrical Signatures & Sensor Evidence Used">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-canvas)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>DC Current Offset</span>
            <strong style={{ fontSize: 'var(--font-size-base)', color: electricalSignatures.iDcDeltaPercent !== null ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
              {electricalSignatures.iDcDeltaPercent !== null && electricalSignatures.iDcDeltaPercent !== undefined ? `${electricalSignatures.iDcDeltaPercent}%` : '--'}
            </strong>
          </div>

          <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-canvas)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>DC Voltage Offset</span>
            <strong style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}>
              {electricalSignatures.vDcDeltaPercent !== null && electricalSignatures.vDcDeltaPercent !== undefined ? `${electricalSignatures.vDcDeltaPercent}%` : '--'}
            </strong>
          </div>

          <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-canvas)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>POA Irradiance at Anomaly</span>
            <strong style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-primary)' }}>
              {electricalSignatures.poaIrradianceWm2 ? formatIrradiance(electricalSignatures.poaIrradianceWm2) : '--'}
            </strong>
          </div>

          <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-canvas)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>Inverter Internal Temp</span>
            <strong style={{ fontSize: 'var(--font-size-base)', color: electricalSignatures.inverterTempC > 60 ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
              {electricalSignatures.inverterTempC ? `${electricalSignatures.inverterTempC} °C` : '--'}
            </strong>
          </div>
        </div>
      </Card>

      {/* Measured vs Expected Comparative Table */}
      <Card title="Measured vs Expected Physical Behavior" style={{ padding: 0 }}>
        <DataTable
          columns={comparisonColumns}
          data={comparisonMetrics}
          keyField="parameter"
          emptyMessage="No comparative telemetry signatures recorded."
        />
      </Card>
    </div>
  );
};

export default DiagnosisEvidenceCard;
