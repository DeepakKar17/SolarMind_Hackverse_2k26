import {
  Drawer,
  Badge,
  StatCard,
  Button,
} from '../common';
import { formatDateTime, formatCurrency, formatEnergy } from '../../utils/formatters';

export const DiagnosisDrawer = ({ isOpen, onClose, diagnosis, onOpenWorkOrder }) => {
  if (!diagnosis) return null;

  const {
    id,
    timestamp,
    faultClass,
    confidenceScore,
    estimatedLostEnergyKwh,
    financialDeficitInr,
    electricalSignatures = {},
    rootCauseSummary,
    status,
  } = diagnosis;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Fault Diagnosis Report: ${id}`}
      width="480px"
      footer={
        <div style={{ display: 'flex', gap: 'var(--space-2)', width: '100%', justifyContent: 'flex-end' }}>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {onOpenWorkOrder && (
            <Button
              variant="primary"
              onClick={() => {
                onClose();
                onOpenWorkOrder(diagnosis);
              }}
            >
              Generate Work Order
            </Button>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {/* Header summary */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Badge variant={status === 'ACTIVE' ? 'warning' : 'success'} dot>
            {status}
          </Badge>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            {formatDateTime(timestamp)}
          </span>
        </div>

        {/* Root Cause Card */}
        <div
          style={{
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-bg-subtle)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
            Root Cause Diagnosis
          </div>
          <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', marginBottom: '4px' }}>
            {faultClass.replace(/_/g, ' ')}
          </h4>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
            {rootCauseSummary}
          </p>
          <div style={{ marginTop: '8px', fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 600 }}>
            Diagnostic Confidence: {confidenceScore}%
          </div>
        </div>

        {/* Quantified Impact */}
        <div>
          <h4 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
            Quantified Loss Impact
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <StatCard
              title="Daily Lost Energy"
              value={formatEnergy(estimatedLostEnergyKwh)}
              variant="warning"
            />
            <StatCard
              title="Financial Loss"
              value={formatCurrency(financialDeficitInr)}
              variant="danger"
            />
          </div>
        </div>

        {/* Measured Electrical Signatures */}
        <div>
          <h4 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
            Inverter Electrical Signatures
          </h4>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
              fontSize: 'var(--font-size-xs)',
              backgroundColor: 'var(--color-bg-canvas)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
            }}
          >
            {electricalSignatures.iDcDeltaPercent !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>DC Current Deviation:</span>
                <strong style={{ color: 'var(--color-danger)' }}>{electricalSignatures.iDcDeltaPercent}%</strong>
              </div>
            )}
            {electricalSignatures.vDcDeltaPercent !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>DC Voltage Deviation:</span>
                <strong style={{ color: 'var(--color-text-primary)' }}>{electricalSignatures.vDcDeltaPercent}%</strong>
              </div>
            )}
            {electricalSignatures.poaIrradianceWm2 !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Plane-of-Array Irradiance:</span>
                <strong>{electricalSignatures.poaIrradianceWm2} W/m²</strong>
              </div>
            )}
            {electricalSignatures.inverterTempC !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Inverter IGBT Temperature:</span>
                <strong>{electricalSignatures.inverterTempC}°C</strong>
              </div>
            )}
            {electricalSignatures.vAcGridV !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Grid AC Voltage:</span>
                <strong style={{ color: 'var(--color-danger)' }}>{electricalSignatures.vAcGridV} V</strong>
              </div>
            )}
          </div>
        </div>
      </div>
    </Drawer>
  );
};

export default DiagnosisDrawer;
