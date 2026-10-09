import { Card, Badge } from '../common';
import { Cpu, ShieldCheck, Clock, Radio, Zap, HardDrive } from 'lucide-react';
import { formatCapacity, formatDateTime, formatRelativeTime } from '../../utils/formatters';

export const InverterSpecsCard = ({ inverter }) => {
  return (
    <Card title="Hardware Specification & Operational Telemetry Metadata">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-4)',
          fontSize: 'var(--font-size-sm)',
        }}
      >
        <div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>
            Manufacturer & Model
          </div>
          <strong style={{ color: 'var(--color-text-primary)' }}>
            {inverter.manufacturer} • {inverter.model}
          </strong>
        </div>

        <div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>
            Hardware Serial Number
          </div>
          <strong style={{ color: 'var(--color-primary)' }}>
            {inverter.serialNumber}
          </strong>
        </div>

        <div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>
            Rated Electrical Capacity
          </div>
          <strong style={{ color: 'var(--color-text-primary)' }}>
            {formatCapacity(inverter.ratedAcPowerKw)} (Max DC: {formatCapacity(inverter.maxDcPowerKw)})
          </strong>
        </div>

        <div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>
            Firmware Version
          </div>
          <strong style={{ color: 'var(--color-text-primary)' }}>
            {inverter.firmwareVersion || 'v1.0.0'}
          </strong>
        </div>

        <div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>
            Anti-Islanding Protection
          </div>
          <div style={{ marginTop: '2px' }}>
            <Badge variant={inverter.antiIslandingArmed ? 'success' : 'danger'} dot>
              {inverter.antiIslandingArmed ? 'Armed & Active (IEEE 1547)' : 'Disabled / Disconnected'}
            </Badge>
          </div>
        </div>

        <div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>
            Data Freshness & Provenance
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: '2px' }}>
            <Badge variant={inverter.dataFreshnessSec < 60 ? 'success' : inverter.dataFreshnessSec < 3600 ? 'warning' : 'neutral'} dot>
              {formatRelativeTime(inverter.lastSuccessfulUpdate)}
            </Badge>
            <Badge variant="warning">
              {inverter.dataSource || 'SIMULATED'}
            </Badge>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default InverterSpecsCard;
